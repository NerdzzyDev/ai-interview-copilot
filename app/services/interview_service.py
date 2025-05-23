from openai import OpenAI
from app.core.config import settings
from pydantic import BaseModel
from typing import List


# Data model
class Message(BaseModel):
    role: str
    content: str


# OpenAI response generation
def generate_response(messages: List[Message], resume_summary: str, job_summary: str):
    """Generate a response based on the interview context."""
    system_prompt = f"""
    Вы являетесь вторым пилотом на собеседовании и помогаете кандидату во время собеседования при приеме на работу.
    Дайте краткие, профессиональные ответы на вопросы собеседования.

    Краткое содержание резюме: {resume_summary}

    Ваши ответы должны быть на русском языке и:
    0. Для технических вопросов по python или другим технологиям дай краткий ответ а затем пояснение с примером кода ответы должны быть понятные и короткие
    1. Учитывайте опыт кандидата и требования к работе
    2. Будьте профессиональны и разговорчивы
    3. Будьте честны, но позитивны
    4. Продемонстрируйте соответствующие навыки и опыт
    5. Будьте прямолинейны и по существу
    6. Создавайте текст человеческим языком, чтобы он не выглядел как созданный искусственным интеллектом.

    Отвечайте на вопросы интервьюера так, как если бы вы были кандидатом.
    """

    full_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": msg.role, "content": msg.content} for msg in messages
    ]

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=full_messages,
            stream=True,
            max_tokens=300  # Limit response to 500 tokens
        )
        return response
    except Exception as e:
        # Return a simple iterator with an error message if OpenAI fails
        class ErrorResponse:
            def __init__(self, error_message):
                self.error_message = error_message
                self.sent = False

            def __iter__(self):
                return self

            def __next__(self):
                if not self.sent:
                    self.sent = True

                    class Choice:
                        def __init__(self, content):
                            self.delta = type('obj', (object,), {'content': content})

                    class FakeResponse:
                        def __init__(self, content):
                            self.choices = [Choice(content)]

                    return FakeResponse(f"Sorry, I encountered an error: {self.error_message}")
                else:
                    raise StopIteration

        return ErrorResponse(str(e))


import asyncio
import logging
import os
from typing import AsyncGenerator
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()


class InterviewService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        # Load prompt
        try:
            with open("prompt.txt", "r") as f:
                self.system_prompt = f.read()
        except FileNotFoundError:
            self.system_prompt = "You are a helpful interview assistant providing concise and accurate answers."

        # Load resume
        try:
            with open("resume.md", "r") as f:
                resume_content = f.read()
            self.resume_summary = self._generate_resume_summary(resume_content)
        except FileNotFoundError:
            self.resume_summary = "No resume available."

        self.conversation_history = []
        self.is_stopped = False

    def _generate_resume_summary(self, resume_content: str) -> str:
        # Simplified summary logic (can be enhanced with OpenAI)
        return f"Resume Summary: {resume_content[:200]}..." if resume_content else "No resume provided."

    async def initialize(self) -> dict:
        return {
            "resume_summary": self.resume_summary
        }

    async def process_transcription(self, transcription: str) -> AsyncGenerator[dict, None]:
        if not transcription.strip():
            return

        self.conversation_history.append({"role": "user", "content": transcription})

        yield {
            "type": "question",
            "text": transcription,
            "timestamp": asyncio.get_event_loop().time()
        }

        try:
            stream = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    *self.conversation_history
                ],
                stream=True,
                max_tokens=500
            )

            answer = ""
            async for chunk in stream:
                if self.is_stopped:
                    self.is_stopped = False
                    yield {
                        "type": "answer_stopped",
                        "message": "Answer stopped by user action",
                        "timestamp": asyncio.get_event_loop().time()
                    }
                    return

                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    answer += content
                    yield {
                        "type": "answer_chunk",
                        "text": content,
                        "timestamp": asyncio.get_event_loop().time()
                    }

            self.conversation_history.append({"role": "assistant", "content": answer})
            yield {
                "type": "answer_complete",
                "timestamp": asyncio.get_event_loop().time()
            }

        except Exception as e:
            logging.error(f"Error processing transcription: {str(e)}")
            yield {
                "type": "answer_stopped",
                "message": f"Error: {str(e)}",
                "timestamp": asyncio.get_event_loop().time()
            }

    def stop_answer(self):
        self.is_stopped = True