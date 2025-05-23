from fastapi import APIRouter, WebSocket
from app.utils.pdf_utils import get_resume_summary, get_job_description_summary
from app.services.interview_service import generate_response, Message
from datetime import datetime
import json
import asyncio

router = APIRouter()


async def handle_websocket_interview(websocket: WebSocket):
    await websocket.accept()

    # Initialize context
    conversation_history = []
    resume_summary = get_resume_summary()
    job_summary = get_job_description_summary()
    stop_streaming = False

    # Send initialization message
    await websocket.send_text(json.dumps({
        "type": "initialization",
        "resume_summary": resume_summary,
        "job_summary": job_summary
    }))

    try:
        while True:
            data = await websocket.receive_text()
            text_data_json = json.loads(data)
            message_type = text_data_json.get("type")

            if message_type == "transcription":
                transcribed_text = text_data_json.get("text", "")
                timestamp = datetime.now().strftime("%H:%M:%S")

                # Add to conversation history
                conversation_history.append(Message(role="user", content=transcribed_text))

                # Send acknowledgment of received question
                await websocket.send_text(json.dumps({
                    "type": "question",
                    "text": transcribed_text,
                    "timestamp": timestamp
                }))

                # Reset stop flag for new response
                stop_streaming = False
                print(f"Processing question: {transcribed_text}")

                # Generate response
                response_stream = generate_response(conversation_history, resume_summary, job_summary)

                # Collect the full response for history
                full_response = ""

                # Process and send streaming response
                try:
                    async for chunk in process_openai_stream(response_stream):
                        if stop_streaming:
                            raise StopIteration("Streaming stopped by user")
                        if chunk:
                            full_response += chunk
                            await websocket.send_text(json.dumps({
                                "type": "answer_chunk",
                                "text": chunk,
                                "timestamp": timestamp
                            }))
                            await asyncio.sleep(0.01)  # Simulate natural typing speed
                except StopIteration as e:
                    print(str(e))

                if not stop_streaming:
                    # Add AI response to conversation history
                    conversation_history.append(Message(role="assistant", content=full_response))

                    # Send end of response marker
                    await websocket.send_text(json.dumps({
                        "type": "answer_complete",
                        "timestamp": timestamp
                    }))
                    print("Answer completed")

            elif message_type == "stop":
                stop_streaming = True
                await websocket.send_text(json.dumps({
                    "type": "answer_stopped",
                    "message": "Answer stopped by user action",
                    "timestamp": datetime.now().strftime("%H:%M:%S")
                }))
                print("Stop message received")

    except Exception as e:
        print(f"WebSocket error: {str(e)}")
    finally:
        await websocket.close()


@router.websocket("/ws/interview")
async def websocket_interview(websocket: WebSocket):
    await handle_websocket_interview(websocket)


@router.websocket("/ws/interview/")
async def websocket_interview_trailing_slash(websocket: WebSocket):
    await handle_websocket_interview(websocket)


async def process_openai_stream(response_stream):
    """Process OpenAI streaming response and yield content chunks."""
    for chunk in response_stream:
        if hasattr(chunk.choices[0], "delta") and hasattr(chunk.choices[0].delta, "content"):
            content = chunk.choices[0].delta.content
            if content:
                yield content
        await asyncio.sleep(0.01)  # Reduced delay for faster response