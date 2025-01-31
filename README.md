# Grant Proposal Generator

This application helps generate grant proposals using AI, based on previous proposals and specific requirements.

## Setup

1. Frontend Setup:
```bash
npm install
```

2. Backend Setup:
```bash
cd backend
pip install -r requirements.txt
```

3. Configure OpenAI API:
- Add your OpenAI API key to `backend/.env`

## Running the Application

1. Start the backend:
```bash
cd backend
uvicorn main:app --reload
```

2. Start the frontend:
```bash
npm run dev
```

## Features

- Upload up to 5 previous grant proposals
- Input specific requirements for the new proposal
- Generate AI-powered grant proposals using OpenAI
- Modern, responsive UI