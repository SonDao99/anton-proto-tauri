from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional, Iterable, Union

Role = str  # 'system' | 'user' | 'assistant'

class ChatMessage(dict):
    # { "role": Role, "content": str }
    pass

class ModelCallConfig(dict):
    # e.g., {"temperature": 0.3, "model": "meta-llama/llama-3.1-8b-instruct:free"}
    pass

class ModelClient(ABC):
    @abstractmethod
    def stream_chat(
        self,
        messages: List[ChatMessage],
        config: Optional[ModelCallConfig] = None,
    ) -> Iterable[str]:
        """Yield incremental text deltas for a chat completion."""
        raise NotImplementedError
