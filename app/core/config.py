from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    DEEPGRAM_API_KEY: str
    RESUME_DIR: str = str(Path("resume"))
    JOB_DESCRIPTION_DIR: str = str(Path("job_description"))

    class Config:
        # env_file = str(Path(__file__).resolve().parent.parent / ".env")
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()