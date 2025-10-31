from typing import Dict, Optional
import asyncio
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self._sockets: Dict[str, WebSocket] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()

    async def connect(self, thread_id: str, websocket: WebSocket):
        async with self._lock:
            self._sockets[thread_id] = websocket

    async def disconnect(self, thread_id: str):
        async with self._lock:
            if thread_id in self._tasks:
                task = self._tasks.pop(thread_id)
                task.cancel()
            self._sockets.pop(thread_id, None)

    async def get_socket(self, thread_id: str) -> Optional[WebSocket]:
        async with self._lock:
            return self._sockets.get(thread_id)

    async def start_stream_task(self, thread_id: str, task_coro):
        async with self._lock:
            if thread_id in self._tasks and not self._tasks[thread_id].done():
                self._tasks[thread_id].cancel()
            self._tasks[thread_id] = asyncio.create_task(task_coro)
