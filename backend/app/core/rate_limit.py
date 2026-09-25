"""In-process sliding-window rate limiter.

Good enough for a single instance and as a second line of defence behind an edge limiter.
Each worker process keeps its own counters, so the effective limit scales with worker count.
"""

import math
import threading
import time
from collections import deque


class SlidingWindowLimiter:
    def __init__(self, *, max_keys: int = 50_000) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._max_keys = max_keys

    def hit(self, key: str, limit: int, window_seconds: float = 60.0) -> int | None:
        """Record one hit. Returns None when allowed, otherwise seconds until a slot frees up."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                if len(self._hits) >= self._max_keys:
                    self._evict(now, window_seconds)
                hits = self._hits[key] = deque()
            while hits and now - hits[0] >= window_seconds:
                hits.popleft()
            if len(hits) >= limit:
                return max(1, math.ceil(window_seconds - (now - hits[0])))
            hits.append(now)
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def _evict(self, now: float, window_seconds: float) -> None:
        # Drop idle keys first; if every key is active, drop the oldest half to bound memory.
        for key in [k for k, v in self._hits.items() if not v or now - v[-1] >= window_seconds]:
            del self._hits[key]
        if len(self._hits) >= self._max_keys:
            for key in list(self._hits)[: self._max_keys // 2]:
                del self._hits[key]


limiter = SlidingWindowLimiter()
