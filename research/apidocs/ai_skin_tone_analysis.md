# AI Facial Color Tones Analyzer

# Overview
The AI Facial Color Tones Analyzer detects facial skin tone, eye, eyebrow, lip & hair colors. This inclusive technology ensures to a complete tailored shopping experience for all ethnicities.

![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/img_Face_Ratio_sec_02_02_enu_21a3d8d423.jpg)

![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/shade_finder_s5_poster_2_8a8f9307d2.png)


## Integration Guide
* How to Take Photos for AI Facial Color Tones Analyzer

  Take a selfie facing forward
  - Just one clear shot, looking straight into the camera. Leave your hair down so it falls over your chest, and make sure you're staring directly ahead for that front-on view.
  - Instead, use the JS Camera Kit to take a photo. Just leave your hair down so it falls over your chest. Don't tie it up.

* How to Detect Skin Concerns by AI
1. **Resize your source image**</br>
  Resize your photo to fit the supported dimensions. See details in **[File Specs & Errors](#section/overview/File-Specs-and-Errors)**

2. **Upload file using the File API**</br>
  Using the ***/s2s/v2.0/file*** API to upload a target user image.
    - Image Requirements
      - See details in **[File Specs & Errors](#section/overview/File-Specs-and-Errors)**.
    - ***Important***: Simply calling the File API does not upload your file. You must **manually upload** the file to the **URL provided in the File API response**. That URL is your upload destination, make sure the file is successfully transferred there before proceeding.<br>
    Before calling the AI API, ensure your file has been successfully uploaded. Use the File API to retrieve an upload URL, then upload your file to that location. Once the upload is complete, you'll receive a ***file_id*** in the response, this ID is what you'll use to access AI features related to that file.

      > **Warning:** Please note that, you will get an 500 Server Error / unknown_internal_error or 404 Not Found error when using AI APIs if you do not upload the file to the URL provided in the File API response.

3. **Run an AI Facial Color Tones Analyzer task**</br>
  Once your upload is complete, the AI will use your file ID to examine the color tones of your lips, eyes, eyebrows, skin, and hair. Please refer to the **[Inputs & Outputs](#section/overview/Inputs-and-Outputs)**.</br>
  Subsequently, calling POST 'task/skin-tone-analysis' with the
  File ID executes the enhance task and obtains a ***task_id***.

4. **Polling to check the status of a task until it succeed or error**</BR>
This ***task_id*** is used to monitor the task's status through polling GET 'task/skin-tone-analysis' to retrieve the current engine status. Until the engine completes the task, the status will remain 'running', and no units will be consumed during this stage.

    **Warning:** Please note that, **Polling** to check the status of a task based on it's retention period is mandotary. A task will be timed out if there is no polling request within the retention period, even if the task is processed succefully(Your unit(s) will be consumed).

    > **Warning:** You will get a ***InvalidTaskId*** error once you check the status of a timed out task. So, once you run an AI task, you need to **polling** to check the status within the retention period until the status become either *success* or *error*.

5. **Get the result of an AI task once success**</BR>
The task will change to the 'success' status after the engine successfully processes your input file and generates the resulting image. You will get an url of the processed image and a dst_id that allow you to chain another AI task without re-upload the result image.
Your units will only be consumed in this case. If the engine fails to process the task, the task's status will change to 'error' and no unit will be consumed.</BR>
When deducting units, the system will prioritize those nearing expiration. If the expiration date is the same, it will deduct the units obtained on the earliest date.

![](https://plugins-media.makeupar.com/smb/blog/post/2022-08-19/2a1af800-7c69-44a5-a94c-70a4a9c4d2b0.jpg)

---

## Inputs & Outputs
* Inputs
The AI will analyse the color tones of your skin. You may adjust the `face_angle_strictness_level` to control the checking strictness of the input face angle, ranging from strict, high, medium, low to flexible. The strictness level applies to face angle detection, including pitch, yaw and roll. A stricter level ensures more accurate face attribute results. The default setting is high.

![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/shade_finder_s4_poster_399f34c6ef.jpg)

* Outputs
```json
{
  "status": 200,
  "data": {
    "task_status": "success",
    "results": {
      "color": {
        "eye_color": "#293F9B",
        "eye_color_name": "Blue",
        "lip_color": "#D23245",
        "eyebrow_color": "#5B2B31",
        "skin_color": "#b9947c",
        "hair_color": "#a0a0a0",
        "hair_color_name": "Auburn"
      }
    }
  }
}
```

| **Result Parameter** | **Result Types** |
|  --- | --- |
| `skin_color` | Hex value |
| `eye_color`| Hex value |
| `eye_color_name` | Amber, Brown, Green, Blue, Gray, Other |
| `lip_color` | Hex value |
| `eyebrow_color` | Hex value |
| `hair_color` | Hex value |
| `color.hair_color_name` | Auburn, Black, Blonde, Brown, Grey/White, Red |


* Suggestions for How to Shoot:
![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/strapi/assets/webp_AI%20Skin%20Analysis_camera_f93315b088.png)

> **Warning:** The width of the face needs to be greater than 60% of the width of the image.

---

## File Specs & Errors
* Supported Formats & Dimensions

| AI Feature | Supported Dimensions | Supported File Size | Supported Formats |
| ---- | ---- | ----  | ---- |
| AI Facial Color Tones Analyzer | long side <= 4096, single person only. Images with a side longer than 1080px are automatically resized for analysis. | < 10MB | jpg/jpeg |

* Error Codes

|Error Code|Description|
|  ----  | ----  |
| error_below_min_image_size | Source image dimensions must be at least 320 pixels. |
| error_face_position_invalid | Face must be fully visible, forward-facing, and centered in the image. |
| error_face_position_too_small | Detected face is too small for analysis. |
| error_face_position_out_of_boundary | Face extends beyond image boundaries. |
| error_face_not_forward_facing | Face must be directly facing the camera. |
| error_face_angle_upward | Face is angled too far upward—slightly tilt head down. |
| error_face_angle_downward | Face is angled too far downward — slightly tilt head up. |
| error_face_angle_leftward | Face is turned too far left — slightly rotate head right. |
| error_face_angle_rightward | Face is turned too far right — slightly rotate head left. |
| error_face_angle_left_tilt | Face is tilted too far left — gently tilt head right. |
| error_face_angle_right_tilt | Face is tilted too far right — gently tilt head left. |

* Environment & Dependency

| Sample Code Language / Tool | Recommended Runtime Versions |
|---|---|
| cURL | - bash >= 3.2</br>   - curl >= 7.58 (modern TLS/HTTP support)</br>   - jq >= 1.6 (robust JSON parsing) |
| Node.js (JavaScript) | Node >= 18 (for global fetch) |
| JavaScript | - Chrome / Edge >= 80</br>   - Firefox >= 74</br>   - Safari >= 13.1 |
| PHP | PHP >= 7.4 (for modern TLS/compat), ext-curl (recommended) or allow_url_fopen=On + ext-openssl, ext-json |
| Python | Python >= 3.10 (for f-strings), requests >= 2.20.0 |
| Java | Java 11+ (for HttpClient), Jackson Databind >= 2.12.0 |

---

## JS Camera Kit
{% partial file="/_partials/js-camera-kit.md" /%}


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

[AI Facial Color Tones Analyzer](https://docs.perfectcorp.com/_bundle/reference/ai_skin_tone_analysis.yaml)

## V1.0

### Run an Skin Tone Analysis task.

 - [POST /s2s/v2.0/task/skin-tone-analysis](https://docs.perfectcorp.com/reference/ai_skin_tone_analysis/v1.0/paths/~1s2s~1v2.0~1task~1skin-tone-analysis/post.md): This endpoint initiates the skin tone analysis process. You must provide a source file (via URL or File ID) and optionally specify face angle strictness level. The task will be processed asynchronously, and you can check its status using the task_id returned in this response.

### Check an Skin Tone Analysis task status.

 - [GET /s2s/v2.0/task/skin-tone-analysis/{task_id}](https://docs.perfectcorp.com/reference/ai_skin_tone_analysis/v1.0/paths/~1s2s~1v2.0~1task~1skin-tone-analysis~1%7Btask_id%7D/get.md)

