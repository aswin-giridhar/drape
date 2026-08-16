# AI Fitzpatrick Skin Type Analysis

# Overview

![](https://plugins-media.makeupar.com/smb/blog/post/2026-01-28/webp_a00e88ca-e20a-4082-89c2-9d486b03b8e8.webp)

**AI Fitzpatrick Skin Type Analysis**

Integrate AI driven Fitzpatrick skin type detection into your applications to classify skin types accurately using camera input. This API enables developers to build personalized skincare, sunscreen, and product recommendation workflows for eCommerce and digital health platforms.

**Skin Type Detection**

The API uses computer vision and machine learning models to analyze skin characteristics and return a Fitzpatrick classification in a single request. It provides structured, objective data that can be directly consumed by frontend applications, recommendation engines, or clinical systems.

The Fitzpatrick Scale, introduced by Dr. Thomas B. Fitzpatrick, defines six skin types based on melanin levels and response to UV exposure, allowing systems to predict tendencies to burn or tan.

**Classification Output**

The API returns one of six standardized skin types from Type I to Type VI based on UV response modeling.

This output enables developers to deliver tailored product recommendations, automate skincare workflows, and enhance personalization logic across user experiences while maintaining consistency and scalability.

| Fitzpatrick Scale | Skin Type | Skin Reaction to Sun |
|  ----  | ----  | ---- |
| Type I | White | Almost always burns, never tans |
| Type II |  Beige | Usually burns, tans minimally |
| Type III | Light Brown | Sometimes burns, gradually tans |
| Type V | Medium Brown | Rarely burns, tans easily |
| Type V | Dark Brown | Very rarely burns |
| Type VI | Very Dark Brown | Almost never burns |

![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/fitapatrick_skin_type_S_02_enu_5e4343e801.jpg)

![](https://plugins-media.makeupar.com/smb/blog/post/2026-03-10/webp_b9ca4198-1a9e-44df-9551-ac3ad8b65d17.webp)

---

## Integration Guide

**1. Capture Image**
Capture a front facing image with adequate lighting. Ensure the face is clearly visible and occupies a sufficient portion of the frame.


**2. Upload Image**
Request upload URLs and file IDs via:

```
POST /s2s/v2.0/file
```

Upload the image using the returned URL.
Alternatively, provide a publicly accessible image URL hosted on your own storage.


**3. Optional Preprocessing**

```
POST /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process
```

Use this step when the image contains multiple faces or when explicit target selection is required. For single face images, this step can be skipped if default indexing is sufficient.


**4. Retrieve Preprocess Result**

```
GET /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process
```

Configure a [webhook](/develop/webhook.md) or implement polling to retrieve task results. With webhooks, your application receives automatic notifications when the task is completed. With polling, your system repeatedly calls the task endpoint until the status changes from running to success or error.

**5. Execute Analysis Task**

```
POST /s2s/v2.0/task/fitzpatrick-scale-analyzer
```

Submit the task using file IDs or image URLs as input. The response returns a task_id for tracking and retrieving the result.


**6. Retrieve Task Result**

```
GET /s2s/v2.0/task/fitzpatrick-scale-analyzer/{task_id}
```

Use the task ID to track status and obtain results.

[Webhooks](/develop/webhook.md) can be configured to receive asynchronous notifications on task completion with a success or error status. Polling is also supported by repeatedly calling the task endpoint until the status is updated from running to success or error.

Usage is only charged when the task completes successfully.

---

## File Specs & Errors

* Supported Formats & Dimensions

|AI Feature|Supported Dimensions|Supported File Size|Supported Formats|
|  ----  | ----  | ----  | ----  |
| AI Fitzpatrick Skin Type Analysis | The length of the longer side shall not exceed 4096 pixels, and the length of the shorter side shall be no less than 320 pixels. | < 10MB | jpg/jpeg |

* Error Codes

|Error Code|Description|
|  ----  | ----  |
| error_below_min_image_size | Source image dimensions must be at least 320 pixels. |
|error_face_position_invalid|Your face needs to be fully visible in the image, without any parts cut off|
|error_face_position_too_small|The face in your photo is too small to analyze properly|
|error_face_position_out_of_boundary|Your face is either too large or partially outside the edges of the photo|
|error_insufficient_lighting|The lighting is too dim, which makes analysis difficult|
|error_face_angle_invalid|Your face angle isn't quite right. For front-facing shots, keep your head within 10 degrees of straight. For side-facing shots, the angle should be more than 15 degrees|

* Environment & Dependency

| Sample Code Language / Tool | Recommended Runtime Versions |
|---|---|
| cURL | - bash >= 3.2</br>   - curl >= 7.58 (modern TLS/HTTP support)</br>   - jq >= 1.6 (robust JSON parsing) |
| Node.js (JavaScript) | Node >= 18 (for global fetch) |
| JavaScript | - Chrome / Edge >= 80</br>   - Firefox >= 74</br>   - Safari >= 13.1 |
| PHP | PHP >= 7.4 (for modern TLS/compat), ext-curl (recommended) or allow_url_fopen=On + ext-openssl, ext-json |
| Python | Python >= 3.10 (for f-strings), requests >= 2.20.0 |
| Java | Java 11+ (for HttpClient), Jackson Databind >= 2.12.0 |


License: Privacy policy

## Servers

```
https://yce-api-01.makeupar.com
```

## Security

### BearerAuthenticationV2

Use the standard 'Bearer authentication'. Put your 'API Key' in header: `Authorization:Bearer YOUR_API_KEY`. Notice that there is ' ' a space between 'Bearer' and the 'YOUR_API_KEY'.

Type: http
Scheme: bearer

## Download OpenAPI description

[AI Fitzpatrick Skin Type Analysis](https://docs.perfectcorp.com/_bundle/reference/ai_fitzpatrick_skin_type.yaml)

## V2.0

AI Fitzpatrick Skin Type Analysis precisely categorizes skin tones into six types, from Type I: White, Type II: Beige, Type III: Light Brown, Type V: Medium Brown, Type V: Dark Brown, to Type VI: Very Dark Brown, based on melanin levels and sensitivity to UV exposure. This system predicts how likely your skin is to burn or tan. 

### Run an AI Fitzpatrick Scale Analyzer detection task.

 - [POST /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process](https://docs.perfectcorp.com/reference/ai_fitzpatrick_skin_type/v2.0/paths/~1s2s~1v2.0~1task~1fitzpatrick-scale-analyzer~1pre-process/post.md): Use the pre-process task when the source image may contain more than one valid target, or when your integration needs to explicitly choose which detected target receives the effect. For single-target images, pre-process can be skipped when the feature supports a default index value and your application does not need manual target selection.

The pre-process task detects candidate targets in the source image and returns their coordinates in data.results.result. Each item in the result array represents one detected target. Review the returned coordinates, map them to the intended face or region in the source image, and use that item's zero-based array index as the index value when creating the effect task.

For images with multiple detected faces or regions, do not rely on the default index value without checking the pre-process result. The effect is applied only to the target selected by index, so the integration must confirm the result item that corresponds to the intended target before running the effect task.

This task is asynchronous. After creating the task, handle completion with webhook if the feature supports it, or poll the corresponding pre-process status endpoint until data.task_status is success or error.

### Check the status of a AI Fitzpatrick Scale Analyzer detection task.

 - [GET /s2s/v2.0/task/fitzpatrick-scale-analyzer/pre-process/{task_id}](https://docs.perfectcorp.com/reference/ai_fitzpatrick_skin_type/v2.0/paths/~1s2s~1v2.0~1task~1fitzpatrick-scale-analyzer~1pre-process~1%7Btask_id%7D/get.md)

### Run an AI Fitzpatrick Scale Analyzer task.

 - [POST /s2s/v2.0/task/fitzpatrick-scale-analyzer](https://docs.perfectcorp.com/reference/ai_fitzpatrick_skin_type/v2.0/paths/~1s2s~1v2.0~1task~1fitzpatrick-scale-analyzer/post.md): AI tasks are asynchronous. Prefer webhook-based completion handling when the feature supports webhooks. Configure your webhook endpoint, verify webhook signatures, and use the received task_id to query the task result after a success or error notification. See the webhook integration guide for setup and verification details.

If webhooks are not supported for the feature, or if your integration cannot use webhooks, implement polling. After starting an AI task, keep polling the task status endpoint at the given polling_interval until the task status is either success or error.

Do not stop polling a running task for longer than the allowed polling window. If the task is not polled in time, the task may expire; a later status check can return InvalidTaskId even if processing finished, and the consumed units may still be charged.

### Check the status of a AI Fitzpatrick Scale Analyzer task.

 - [GET /s2s/v2.0/task/fitzpatrick-scale-analyzer/{task_id}](https://docs.perfectcorp.com/reference/ai_fitzpatrick_skin_type/v2.0/paths/~1s2s~1v2.0~1task~1fitzpatrick-scale-analyzer~1%7Btask_id%7D/get.md)

