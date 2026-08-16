# AI Face Attributes & Ratio Analyzer

# Overview
The AI Face Attributes & Ratio Analyzer examines face structure, identifying features like face, eye, eyebrow, lip, nose, cheekbone shapes, designed to provide personalized recommendations.

## Integration Guide
* How to Take Photos for AI Face Attributes & Ratio Analyzer

* Take a selfie facing forward
  - Just one clear photo, looking straight into the camera. It is best to let your hair fall naturally, with your entire face visible and nothing covering it. Brush your hair back to reveal your forehead, and make sure you are looking directly ahead to capture a proper front view.
  - Instead, use the JS Camera Kit to take the photo. Follow the automatic face alignment, lighting guidance, and face size detection to ensure the photo meets the required standards for processing.

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

3. **Run an AI Face Attributes & Ratio Analyzer task**</br>
  Once the upload is complete, you can select multiple face attributes to analyze using your file ID. Please refer to the **[Inputs & Outputs](#section/overview/Inputs-and-Outputs)**.</br>
  Subsequently, calling POST 'task/face-attr-analysis' with the
  File ID executes the enhance task and obtains a ***task_id***.

4. **Polling to check the status of a task until it succeed or error**</BR>
This ***task_id*** is used to monitor the task's status through polling GET 'task/face-attr-analysis' to retrieve the current engine status. Until the engine completes the task, the status will remain 'running', and no units will be consumed during this stage.

    **Warning:** Please note that, **Polling** to check the status of a task based on it's retention period is mandotary. A task will be timed out if there is no polling request within the retention period, even if the task is processed succefully(Your unit(s) will be consumed).

    > **Warning:** You will get a ***InvalidTaskId*** error once you check the status of a timed out task. So, once you run an AI task, you need to **polling** to check the status within the retention period until the status become either *success* or *error*.

5. **Get the result of an AI task once success**</BR>
The task will change to the 'success' status after the engine successfully processes your input file and generates the resulting image. You will get an url of the processed image and a dst_id that allow you to chain another AI task without re-upload the result image.
Your units will only be consumed in this case. If the engine fails to process the task, the task's status will change to 'error' and no unit will be consumed.</BR>
When deducting units, the system will prioritize those nearing expiration. If the expiration date is the same, it will deduct the units obtained on the earliest date.

* Real-world examples:
![](https://plugins-media.makeupar.com/smb/blog/post/2025-01-15/10a4b980-f571-4d08-8f5d-e3ed48db77aa.jpg)

## Inputs & Outputs
* Face Attributes:
![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/img_Face_Ratio_sec_01_01_enu_79380baa14.jpg)

| **Category**     | **Subcategory**   | **Request Parameter** | **Result Parameter** | **Result Types** |
| --- | --- | --- |  --- | --- |
| **FACE** | Face Shape | `faceShape` | `faceshape` | Triangle, Diamond, Heart, InvTriangle, Oblong, Oval, Round, Square, Unknown |
| **AGE & GENDER** | Age | `age` | `agegender.age` | integer |
| | Gender | `gender` | `agegender.gender` | female, male, unknown |
| **EYES** | Eye Shape | `eyeShape` | `eyelid.left_shape`, `eyelid.right_shape` | Narrow, Round, Almond |
| | Eye Size | `eyeSize` | `eyelid.size` | Big, Small, Average |
| | Eye Angle | `eyeAngle` | `eyelid.left_angle`, `eyelid.right_angle` | Downturned, Upturned, Average |
| | Eye Distance | `eyeDistance` | `eyelid.setting` | Close-set, Wide-Set, Average |
| | Eyelid | `eyelid` | `eyelid.left_eyelid`, `eyelid.right_eyelid` | Hooded-lid, Single-lid, Double-lid, Deep-Set |
| **BROWS** | Eyebrow Shape | `eyebrowShape` | `eyebrow.left_shape`, `eyebrow.right_shape` | Hard Angled, Soft Angled, Straight, Rounded, Obscured |
| | Eyebrow Thickness | `eyebrowThickness` | `eyebrow.left_body_thickness`, `eyebrow.right_body_thickness` | Dense, Sparse, Average, Unknown |
| | Eyebrow Distance | `eyebrowDistance` | `eyebrow.gap` | Far-Apart, Close, Average |
| | Eyebrow Shortness | `eyebrowShortness` | `eyebrow.left_shortness`, `eyebrow.right_shortness` | Short, Normal |
| **LIPS** | Lip Shape | `lipShape` | `lipshape[]` | Bow, Downturned, Full, Heavy Lower Lip, Heavy Upper Lip, Narrow, Round, Thin, Wide, Average |
| **NOSE** | Nose Width | `noseWidth` | `nose.width` | Narrow, Broad, Average |
| | Nose Length | `noseLength` | `nose.length` | Long, Short, Average |
| **CHEEKBONES**   | Cheekbones | `cheekbones` | `cheekbone.left`, `cheekbone.right`, `cheekbone.overrall` | Flat Cheekbone, High Cheekbone, Low Cheekbone, Round Cheeks |


---

* Face Ratios:
![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/img_Face_Ratio_sec_01_03_2fe8f06b92.jpg)

| **Subcategory** | **Request Parameter** | **Result Parameter** | **Result Types** | **Description** |
| --- | --- | --- | --- | --- |
| Horizontal Third Ratio | `horizontalThird` | `horizontal_third` | Three-section percentages; Interpretation: Short / Balanced / Long; Golden Ratio: 33% : 33% : 33% | The Face Horizontal Ratio is based on dividing the face into three equal sections: from the hairline to the bottom of the eyebrows, from the bottom of eyebrows to the bottom of the nose, and from the bottom of the nose to the tip of the chin. The golden ratio, or ideal proportion, between the three is 1:1:1.|
| Vertical Fifth Ratio | `verticalFifth` | `vertical_fifth` | Five-section percentages; Interpretation (Eye Distance & Eye Width): Narrow / Balanced / Wide; Golden Ratio: 20% : 20% : 20% : 20% : 20% | The Face Vertical Ratio is determined by dividing the face into five sections: the width of one eye, the distance between the eyes, and the space between the outer corners of the eyes to the edges of the face. The golden ration for these proportions is 1:1:1:1:1. |
| Face Aspect Ratio | `faceAspectRatio` | `face_aspect_ratio` | `[1, r]`; Interpretation: Short / Balanced / Long; Golden Ratio: 1 : 1.46 | The Face Aspect Ratio is the relationship between the width of the face and its height, ideally following the golden ratio of 1:1.46, thus creating a balanced and aesthetically pleasing appearance. |
| Eye Aspect Ratio | `eyeAspectRatio` | `left_eye_aspect_ratio` `right_eye_aspect_ratio` | `[1, r]`; Interpretation: Round / Balanced / Flat; Golden Ratio: 1 : 3 | The Eye Aspect Ratio is the relationship between the height of the eye compared to its width, ideally aligning with the golden ratio of 1:3, ensuring the most aesthetically balanced look.
 |
| Eyebrow Arch Ratio | `eyebrowArch` | `left_eyebrow_arch_to_eyebrow_width` `right_eyebrow_arch_to_eyebrow_width` | `[1, r]`; Interpretation: Short Arch / Balanced / Long Arch; Golden Ratio: 1 : 1.618 | The ideal proportion of the Eyebrow Arch is determined by the shape of the eyebrow itself, where the highest point (the arch) aligns with the golden ratio for an aesthetically pleasing look. |
| Eye Height to Eyebrow Distance | `eyeHeightToEyebrowDistance` | `left_eye_height_to_eyebrow_distance` `right_eye_height_to_eyebrow_distance` `overall_eye_height_to_eyebrow_distance` | `[1, r]`; Interpretation: Short / Balanced / Long; Golden Ratio: 1 : 1.618 | The Eye to Eyebrow Distance is the vertical distance from the top of the upper eyelid to the highest point of the eyebrow. Ideally, it would follow the golden ratio of 1.618:1 when compared to the eye height, for the most harmonious balance between the eyes and the brows. |
| Nose Aspect Ratio | `noseAspectRatio` | `nose_aspect_ratio` | `[1, r]`; Interpretation: Wide / Balanced / Narrow; Golden Ratio: 1 : 1.618 | The Nose Aspect Ratio is the relationship between the width of the nose and its height, ideally following the golden ratio of 1:1.618. |
| Nose Width to Mouth Width | `noseWidthToMouthWidth` | `nose_width_to_mouth_width` | `[1, r]`; Interpretation: Small / Balanced / Large; Golden Ratio: 1 : 1.618 | The Nose Width to Mouth Width ratio is the relationship between the width of the nose and that of the mouth, ideally following the golden ratio of 1:1.618, creating a balanced and aesthetically pleasing appearance. |
| Nose to Lip to Chin | `noseToLipToChin` | `nose_to_lip_to_chin` | `[1, r]`; Interpretation: Short / Balanced / Long (lower face length); Golden Ratio: 1 : 1.618 | The Nose to Lip to Chin ratio is a proportion where the distance from the base of the nose to the center of the lip is 1, and the ideal distance from the center of the lip to the chin is 1.618. This golden ratio creates a balanced and harmonious lower face, following the principles of facial symmetry. |
| Upper Lip to Lower Lip | `upperLipToLowerLip` | `upper_lip_to_lower_lip` | `[1, r]`; Interpretation: Full Upper / Balanced / Full Lower; Golden Ratio: 1 : 1.618 | The golden ratio of the Upper Lip to the Lower Lip suggests that the thickness of the lower lip should be 1.618 times that of the upper lip. This proportion creates a balanced and aesthetically pleasing look, with the lower lip being slightly fuller than the upper lip. |

----

* Suggestions for How to Shoot:
![](https://bcw-media.s3.ap-northeast-1.amazonaws.com/strapi/assets/AI_Face_Analysis_how_to_shoot_35ca9af08e.png)

> **Warning:** The width of the face needs to be greater than 60% of the width of the image.

## File Specs & Errors
* Supported Formats & Dimensions

|AI Feature|Supported Dimensions|Supported File Size|Supported Formats|
|  ----  | ----  | ----  | ----  |
|AI Face Attributes & Ratio Analyzer|long side <= 4096, single person only. Images with a side longer than 1080px are automatically resized for analysis.|< 10MB|jpg/jpeg|

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

[AI Face Attributes & Ratio Analyzer](https://docs.perfectcorp.com/_bundle/reference/ai_face_analyzer.yaml)

## V1.0

### Run an Face Attribute Analysis task.

 - [POST /s2s/v2.0/task/face-attr-analysis](https://docs.perfectcorp.com/reference/ai_face_analyzer/v1.0/paths/~1s2s~1v2.0~1task~1face-attr-analysis/post.md): This endpoint initiates the face attribute analysis process. You must provide a source file (via URL or File ID) and specify which features to analyze. The task will be processed asynchronously, and you can check its status using the task_id returned in this response.

### Check an Face Attribute Analysis task status.

 - [GET /s2s/v2.0/task/face-attr-analysis/{task_id}](https://docs.perfectcorp.com/reference/ai_face_analyzer/v1.0/paths/~1s2s~1v2.0~1task~1face-attr-analysis~1%7Btask_id%7D/get.md)

