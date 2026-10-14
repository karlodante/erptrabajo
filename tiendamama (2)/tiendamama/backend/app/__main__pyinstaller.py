# Entry point PyInstaller — arranca uvicorn en 127.0.0.1:8765
import argparse
import uvicorn
from app.main import app

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    a = p.parse_args()
    uvicorn.run(app, host=a.host, port=a.port, loop="asyncio", access_log=False)

if __name__ == "__main__":
    main()
