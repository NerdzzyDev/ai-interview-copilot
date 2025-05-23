import os
from pathlib import Path
import PyPDF2
from openai import OpenAI
from app.core.config import settings


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file."""
    if not os.path.exists(file_path):
        return "PDF file not found."

    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                text += page.extract_text()
            return text
    except Exception as e:
        return f"Error extracting text from PDF: {str(e)}"


def get_resume_summary() -> str:
    """Get a summary of the resume."""
    resume_dir = settings.RESUME_DIR

    if not os.path.exists(resume_dir):
        os.makedirs(resume_dir)
        return "Resume directory created. Please add your resume PDF file."

    resume_files = [f for f in os.listdir(resume_dir) if f.endswith('.pdf')]

    if not resume_files:
        return "No resume found in the resume directory."

    resume_path = os.path.join(resume_dir, resume_files[0])
    resume_text = extract_text_from_pdf(resume_path)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an assistant that summarizes resumes."},
            {"role": "user",
             "content": f"Please provide a concise summary of the following resume in about 150 words: {resume_text}"}
        ],
        max_tokens=300
    )

    return response.choices[0].message.content


def get_job_description_summary() -> str:
    """Get a summary of the job description."""
    job_dir = settings.JOB_DESCRIPTION_DIR

    if not os.path.exists(job_dir):
        os.makedirs(job_dir)
        return "Job description directory created. Please add your job description PDF file."

    job_files = [f for f in os.listdir(job_dir) if f.endswith('.pdf')]

    if not job_files:
        return "No job description found in the job description directory."

    job_path = os.path.join(job_dir, job_files[0])
    job_text = extract_text_from_pdf(job_path)

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are an assistant that summarizes job descriptions."},
            {"role": "user",
             "content": f"Please provide a concise summary of the following job description in about 150 words: {job_text}"}
        ],
        max_tokens=300
    )

    return response.choices[0].message.content