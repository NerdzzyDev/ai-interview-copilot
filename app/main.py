from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.endpoints import home as home_router
from app.endpoints import interview as interview_router

app = FastAPI(title="Interview Copilot")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up templates
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(home_router.router)
app.include_router(interview_router.router)