import cv2
from PIL import Image
CASC=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
def smart_face_crop(src_path,out_path,target_w=1200,margin=0.25):
    """Crop so the face occupies ~65% of frame width - required by YouCam skin-analysis."""
    img=cv2.imread(src_path); g=cv2.cvtColor(img,cv2.COLOR_BGR2GRAY)
    fs=sorted(CASC.detectMultiScale(g,1.1,5),key=lambda b:-b[2]*b[3])
    if not len(fs): raise ValueError("no face detected")
    x,y,w,h=fs[0]
    mx,my=int(w*margin),int(h*margin*1.15)
    box=(max(0,x-mx),max(0,y-my),min(img.shape[1],x+w+mx),min(img.shape[0],y+h+my))
    im=Image.open(src_path).convert('RGB').crop(box)
    s=target_w/im.width
    im=im.resize((int(im.width*s),int(im.height*s)),Image.LANCZOS)
    im.save(out_path,'JPEG',quality=95)
    return box,w/ (box[2]-box[0]), im.size
