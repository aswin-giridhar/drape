import json,time,os,base64,urllib.request,urllib.error,urllib.parse
B='https://yce-api-01.perfectcorp.com'
def _env(p='/mnt/e/Hackathon/youcam_vto_hackathon/.env'):
    d={}
    for l in open(p):
        l=l.strip()
        if l and '=' in l and not l.startswith('#'):
            k,v=l.split('=',1); d[k.strip()]=v.strip()
    return d
def auth():
    from Crypto.PublicKey import RSA
    from Crypto.Cipher import PKCS1_v1_5
    e=_env(); key,sec=e['YouCam_API_KEY'],e['YouCam_SecretKey']
    pub=RSA.import_key(base64.b64decode(sec))
    tok=base64.b64encode(PKCS1_v1_5.new(pub).encrypt(
        f"client_id={key}&timestamp={int(time.time()*1000)}".encode())).decode()
    st,d=_raw('POST','/s2s/v1.0/client/auth',{'client_id':key,'id_token':tok},None)
    return d['result']['access_token']
def _raw(m,p,b,tok):
    h={'Content-Type':'application/json'}
    if tok: h['Authorization']='Bearer '+tok
    r=urllib.request.Request(B+p,method=m,data=json.dumps(b).encode() if b is not None else None,headers=h)
    try:
        with urllib.request.urlopen(r,timeout=90) as x: return x.status,json.loads(x.read().decode())
    except urllib.error.HTTPError as e:
        try: return e.code,json.loads(e.read().decode())
        except Exception: return e.code,{}
TOK=None
def call(m,p,b=None):
    global TOK
    if TOK is None: TOK=auth()
    st,d=_raw(m,p,b,TOK)
    if st in (401,403):
        TOK=auth(); st,d=_raw(m,p,b,TOK)
    return st,d
def credits(): return sum(x['amount_dec'] for x in call('GET','/s2s/v1.0/client/credit')[1].get('results',[]))
def upload(feature,path):
    st,d=call('POST',f'/s2s/v2.0/file/{feature}',{'files':[{'content_type':'image/jpeg',
        'file_name':os.path.basename(path),'file_size':os.path.getsize(path)}]})
    if st!=200: raise RuntimeError(f"upload init {st} {d}")
    f=d['data']['files'][0]; rq=f['requests'][0]
    req=urllib.request.Request(rq['url'],method=rq['method'],data=open(path,'rb').read())
    for k,v in (rq.get('headers') or {}).items(): req.add_header(k,v)
    urllib.request.urlopen(req,timeout=300)
    return f['file_id']
def wait(feature,tid,budget=300,every=3):
    enc=urllib.parse.quote(tid,safe=''); t0=time.time()
    while time.time()-t0<budget:
        st,d=call('GET',f'/s2s/v2.0/task/{feature}/{enc}')
        ts=d.get('data',{}).get('task_status')
        if ts in ('success','error','failed'): return time.time()-t0,d
        time.sleep(every)
    return time.time()-t0,{'data':{'task_status':'TIMEOUT'}}
def run(feature,payload):
    before=credits(); t0=time.time()
    st,d=call('POST',f'/s2s/v2.0/task/{feature}',payload)
    if st!=200: return {'ok':False,'err':d,'cost':0,'sec':0}
    el,res=wait(feature,d['data']['task_id'])
    time.sleep(4); after=credits()
    return {'ok':res['data']['task_status']=='success','res':res,
            'cost':before-after,'sec':time.time()-t0,'status':res['data']['task_status']}
SD=['wrinkle','droopy_upper_eyelid','droopy_lower_eyelid','firmness','acne','moisture',
    'eye_bag','dark_circle_v2','age_spot','radiance','redness','oiliness','pore','texture']
