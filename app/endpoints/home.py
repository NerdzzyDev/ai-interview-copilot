from fastapi import APIRouter, Request, HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
import os
from dotenv import load_dotenv, set_key
from pydantic import BaseModel
import logging

router = APIRouter()
templates = Jinja2Templates(directory="templates")
load_dotenv()


# Pydantic model for settings
class Settings(BaseModel):
    theme: str
    openai_api_key: str
    deepgram_api_key: str
    language: str
    prompt: str
    resume: str


@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/settings")
async def settings_api(request: Request):
    return templates.TemplateResponse("settings.html", {"request": request})


@router.get("/api/settings")
async def get_settings():
    try:
        with open("prompt.txt", "r") as f:
            prompt = f.read()
        with open("resume.md", "r") as f:
            resume = f.read()

        return {
            "theme": "light",  # Default, updated by client
            "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
            "deepgram_api_key": os.getenv("DEEPGRAM_API_KEY", ""),
            "language": "ru",  # Default
            "prompt": prompt,
            "resume": resume
        }
    except Exception as e:
        logging.error(f"Error loading settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load settings")


@router.post("/api/settings")
async def save_settings(settings: Settings):
    try:
        # Validate inputs
        if settings.theme not in ["light", "dark"]:
            return JSONResponse({"status": "error", "message": "Invalid theme"})
        if settings.language not in ["ru", "en"]:
            return JSONResponse({"status": "error", "message": "Invalid language"})

        # Save to .env
        set_key(".env", "OPENAI_API_KEY", settings.openai_api_key)
        set_key(".env", "DEEPGRAM_API_KEY", settings.deepgram_api_key)

        # Save prompt
        with open("prompt.txt", "w") as f:
            f.write(settings.prompt)

        # Save resume
        with open("resume.md", "w") as f:
            f.write(settings.resume)

        # Optionally regenerate resume.pdf (requires pandoc/weasyprint)
        # import subprocess
        # subprocess.run(["pandoc", "resume.md", "-o", "resume/resume.pdf"])

        return JSONResponse({"status": "success", "message": "Settings saved"})
    except Exception as e:
        logging.error(f"Error saving settings: {str(e)}")
        return JSONResponse({"status": "error", "message": str(e)})