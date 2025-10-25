# services/llm/openrouter_client.py
import os
from typing import Iterable, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from .model_client import ModelClient, ChatMessage, ModelCallConfig

class OpenRouterClient(ModelClient):
    def __init__(self, default_model: Optional[str] = None, temperature: float = 0.3):
        self.model_name = default_model or os.getenv('OPENROUTER_MODEL', 'meta-llama/llama-3.1-8b-instruct:free')
        self.llm = ChatOpenAI(
            model=self.model_name,
            base_url='https://openrouter.ai/api/v1',
            api_key=os.getenv('OPENROUTER_API_KEY'),
            temperature=temperature,
            streaming=True,
        )

    def _to_lc(self, msgs: List[ChatMessage]):
        converted = []
        for m in msgs:
            role = m.get("role")
            content = m.get("content", "")
            if role == "system":
                converted.append(SystemMessage(content=content))
            elif role == "user":
                converted.append(HumanMessage(content=content))
            elif role == "assistant":
                converted.append(AIMessage(content=content))
        return converted

    def stream_chat(
        self,
        messages: List[ChatMessage],
        config: Optional[ModelCallConfig] = None,
    ) -> Iterable[str]:
        # Allow overrides per call
        if config:
            model = config.get("model") or self.model_name
            temperature = config.get("temperature")
            if model != self.model_name or temperature is not None:
                llm = ChatOpenAI(
                    model=model,
                    base_url='https://openrouter.ai/api/v1',
                    api_key=os.getenv('OPENROUTER_API_KEY'),
                    temperature=temperature if temperature is not None else self.llm.temperature,
                    streaming=True,
                )
            else:
                llm = self.llm
        else:
            llm = self.llm

        for chunk in llm.stream(self._to_lc(messages)):
            if hasattr(chunk, "content") and chunk.content:
                yield chunk.content
