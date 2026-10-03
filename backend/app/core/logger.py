import logging
import sys

def setup_logging():
    # Setup standard python logging
    logger = logging.getLogger("medora")
    
    # Avoid adding multiple handlers if setup is called multiple times
    if not logger.handlers:
        logger.setLevel(logging.INFO)

        if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
            try:
                sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

        # Create console handler with standard level
        ch = logging.StreamHandler(sys.stdout)
        ch.setLevel(logging.INFO)

        # Create standard formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        ch.setFormatter(formatter)
        
        # Add handler to logger
        logger.addHandler(ch)

    return logger

# Create a singleton logger instance to be imported globally
logger = setup_logging()
