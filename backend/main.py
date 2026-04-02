from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import engine, Base
import models  # noqa: ensure all models are registered

from routers import auth, admin, groups, users, friends

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Database connection failed: {e}")
    yield

app = FastAPI(
    title="Zay Phoe – Expense Distribution API",
    description="Multi-user expense splitting platform with role-based access",
    version="1.0.0",
    lifespan=lifespan
)

# origins list for CORS
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://zayphoe.vercel.app",
    "https://zayphoe-backend.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        }
    )

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(groups.router)
app.include_router(users.router)
app.include_router(friends.router)


@app.get("/")
def root():
    return {"message": "Zay Phoe API is running"}
