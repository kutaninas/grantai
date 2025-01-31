from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Optional
import os
from openai import OpenAI
from dotenv import load_dotenv
import json
import logging
import tempfile
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



# Try to import textract, fallback to basic text extraction if not available
try:
    import textract
    TEXTRACT_AVAILABLE = True
    logger.info("textract successfully imported")
except ImportError:
    TEXTRACT_AVAILABLE = False
    logger.warning("textract not available, falling back to basic text extraction")

load_dotenv()

app = FastAPI()

@app.get("/")
async def read_root():
    return {"message": "Hello World"}

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Store uploaded contents and their embeddings in memory
class DocumentStore:
    def __init__(self):
        self.documents: List[Dict] = []
        self.chunk_size = 1000
        self.chunk_overlap = 200
        
    def add_document(self, content: str, filename: str):
        chunks = self._create_chunks(content)
        
        # Generate embeddings for each chunk
        try:
            for chunk in chunks:
                embedding = self._generate_embedding(chunk)
                self.documents.append({
                    "content": chunk,
                    "embedding": embedding,
                    "filename": filename
                })
            logger.info(f"Successfully processed and stored document: {filename}")
        except Exception as e:
            logger.error(f"Error generating embeddings for {filename}: {str(e)}")
            raise
    
    def _create_chunks(self, text: str) -> List[str]:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - self.chunk_overlap
        return chunks
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a chunk of text."""
        try:
            response = client.embeddings.create(
                model="text-embedding-ada-002",
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise

    def get_relevant_chunks(self, query: str, top_k: int = 3) -> List[str]:
        """Get most relevant chunks for a query using cosine similarity."""
        if not self.documents:
            return []
            
        try:
            query_embedding = self._generate_embedding(query)
            
            # Calculate similarities
            similarities = []
            for doc in self.documents:
                similarity = cosine_similarity(
                    [query_embedding],
                    [doc["embedding"]]
                )[0][0]
                similarities.append((similarity, doc["content"]))
            
            # Sort by similarity and return top chunks
            similarities.sort(reverse=True)
            return [content for _, content in similarities[:top_k]]
            
        except Exception as e:
            logger.error(f"Error getting relevant chunks: {str(e)}")
            return []

document_store = DocumentStore()

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extract text from various file formats."""
    logger.info(f"Extracting text from {filename}")
    
    try:
        if filename.endswith('.txt'):
            return file_content.decode('utf-8')
        
        # For doc/docx files
        if TEXTRACT_AVAILABLE:
            # Save temporarily and use textract
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
                temp_file.write(file_content)
                temp_file_path = temp_file.name
            
            try:
                # Extract text using textract
                text = textract.process(temp_file_path).decode('utf-8')
                logger.info(f"Successfully extracted text from {filename} using textract")
                return text
            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)
                logger.info(f"Cleaned up temporary file for {filename}")
        else:
            # If textract is not available, only support txt files
            if not filename.endswith('.txt'):
                raise HTTPException(
                    status_code=400,
                    detail="Only .txt files are supported without textract installation"
                )
            return file_content.decode('utf-8')
    
    except Exception as e:
        logger.error(f"Error extracting text from {filename}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file {filename}: {str(e)}"
        )

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    logger.info(f"Received upload request with {len(files)} files")
    
    if not files:
        logger.warning("No files provided in request")
        raise HTTPException(status_code=400, detail="No files provided")
    
    if len(files) > 5:
        logger.warning(f"Too many files: {len(files)}")
        raise HTTPException(status_code=400, detail="Maximum 5 files allowed")
    
    allowed_extensions = ('.txt',) if not TEXTRACT_AVAILABLE else ('.txt', '.doc', '.docx')
    
    try:
        for file in files:
            logger.info(f"Processing file: {file.filename}")
            
            if not file.filename.lower().endswith(allowed_extensions):
                logger.warning(f"Invalid file type: {file.filename}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unsupported file type for {file.filename}. Only {', '.join(allowed_extensions)} files are allowed."
                )
            
            content = await file.read()
            logger.info(f"Read {len(content)} bytes from {file.filename}")
            
            try:
                text_content = extract_text_from_file(content, file.filename)
                document_store.add_document(text_content, file.filename)
                logger.info(f"Successfully processed {file.filename}")
            except Exception as e:
                logger.error(f"Failed to process {file.filename}: {str(e)}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Error processing file {file.filename}: {str(e)}"
                )
            finally:
                await file.close()
                logger.info(f"Closed file: {file.filename}")
        
        return {
            "message": "Files uploaded successfully",
            "count": len(files),
            "status": "success",
            "textract_available": TEXTRACT_AVAILABLE
        }
    except Exception as e:
        logger.error(f"Error in upload process: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_proposal_chunk(prompt: str) -> str:
    """Generate a single chunk of the proposal."""
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": """You are a professional grant writer. Generate a grant proposal based on the given requirements while maintaining a professional tone and following standard grant writing practices.
                Use markdown formatting for better readability."""},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Error generating proposal chunk: {str(e)}")
        raise

@app.post("/api/generate")
async def generate_proposal(body: Dict[str, str] = Body(...)):
    logger.info("Received proposal generation request")
    
    if not body.get("requirements"):
        logger.warning("No requirements provided in request")
        raise HTTPException(status_code=400, detail="No requirements provided")
    
    try:
        requirements = body["requirements"]
        logger.info(f"Generating proposal for requirements: {requirements[:100]}...")
        
        # Get relevant chunks from uploaded documents
        relevant_chunks = document_store.get_relevant_chunks(requirements)
        context = ""
        if relevant_chunks:
            context = "\n\nRelevant reference materials:\n" + "\n---\n".join(relevant_chunks)
        
        # Generate proposal in chunks if needed
        full_prompt = f"Generate a grant proposal based on these requirements: {requirements}\n{context}"
        
        # For now, we'll generate in one go, but this could be split into sections
        proposal = await generate_proposal_chunk(full_prompt)
        
        logger.info("Successfully generated proposal")
        return {"proposal": proposal}
    except Exception as e:
        logger.error(f"Error generating proposal: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating proposal: {str(e)}")

@app.get("/health")
async def health_check():
    logger.info("Health check requested")
    return {
        "status": "healthy",
        "document_count": len(document_store.documents),
        "textract_available": TEXTRACT_AVAILABLE
    }