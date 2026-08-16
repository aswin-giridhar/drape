# V4.0

Enhanced capabilities to include virtual try-on for outerwear, including jackets and vests. You can now choose from Full Body, Upper Body, Lower Body, Shoes, or Outerwear for virtual try-on, or simply select Auto and let the AI engine create the perfect outfit for you.

## Run an AI Cloth V4 task.

 - [POST /s2s/v2.0/task/cloth-v4](https://docs.perfectcorp.com/reference/ai_clothes/v4.0/paths/~1s2s~1v2.0~1task~1cloth-v4/post.md): AI tasks are asynchronous. Prefer webhook-based completion handling when the feature supports webhooks. Configure your webhook endpoint, verify webhook signatures, and use the received task_id to query the task result after a success or error notification. See the webhook integration guide for setup and verification details.

If webhooks are not supported for the feature, or if your integration cannot use webhooks, implement polling. After starting an AI task, keep polling the task status endpoint at the given polling_interval until the task status is either success or error.

Do not stop polling a running task for longer than the allowed polling window. If the task is not polled in time, the task may expire; a later status check can return InvalidTaskId even if processing finished, and the consumed units may still be charged.

## Check the status of a AI Cloth V4 task.

 - [GET /s2s/v2.0/task/cloth-v4/{task_id}](https://docs.perfectcorp.com/reference/ai_clothes/v4.0/paths/~1s2s~1v2.0~1task~1cloth-v4~1%7Btask_id%7D/get.md)

