# Unit system

Check your unit details and usage history. Please note that Units is the currency used for YouCam API operations; different AI features deduct different amounts of units. In this document, the code name used for a Unit is "Credit."


License: Privacy policy

## Servers

```
https://yce-api-01.makeupar.com
```

## Security

### BearerAuthentication

Use the `access_token` obtained from authentication and pass it in header: `Authorization:Bearer <access_token>`

Type: http
Scheme: bearer

### BearerAuthenticationV2

Use the standard 'Bearer authentication'. Put your 'API Key' in header: `Authorization:Bearer YOUR_API_KEY`. Notice that there is ' ' a space between 'Bearer' and the 'YOUR_API_KEY'.

Type: http
Scheme: bearer

## Download OpenAPI description

[Unit system](https://docs.perfectcorp.com/_bundle/reference/unit_system.yaml)

## Other

### Get unit info

 - [GET /s2s/v1.0/client/credit](https://docs.perfectcorp.com/reference/unit_system/paths/~1s2s~1v1.0~1client~1credit/get.md): Display the available API units to two decimal places

### View unit history

 - [GET /s2s/v1.0/client/credit/history](https://docs.perfectcorp.com/reference/unit_system/paths/~1s2s~1v1.0~1client~1credit~1history/get.md)

### Get feature cost

 - [GET /s2s/v2.0/credit/feature-cost](https://docs.perfectcorp.com/reference/unit_system/paths/~1s2s~1v2.0~1credit~1feature-cost/get.md): Check the unit consumption for each API. The values are consistent with those listed at https://yce.perfectcorp.com/ai-api/api-pricing.

