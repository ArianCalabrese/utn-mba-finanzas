import threading
from typing import Any, Callable
from cachetools import TTLCache

_registry_lock = threading.Lock()
_caches: dict[str, tuple[TTLCache, threading.Lock]] = {}


def _get_cache(name: str, ttl: int) -> tuple[TTLCache, threading.Lock]:
    with _registry_lock:
        if name not in _caches:
            _caches[name] = (TTLCache(maxsize=256, ttl=ttl), threading.Lock())
        return _caches[name]


def get_cached(cache_name: str, key: str, ttl: int, fn: Callable[[], Any]) -> Any:
    """
    Returns the cached value for `key` in `cache_name`, computing it with `fn` on miss.
    Two threads may compute concurrently on a cold miss; the last writer wins.
    This is intentional to avoid holding the lock during network I/O.
    """
    cache, lock = _get_cache(cache_name, ttl)
    with lock:
        if key in cache:
            return cache[key]
    result = fn()
    with lock:
        cache[key] = result
    return result
