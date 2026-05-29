from cryptography.fernet import Fernet
from config import settings

cipher_suite = Fernet(settings.master_encryption_key.encode())

def encrypt_api_key(api_key: str) -> str:
    """Takes a raw API key and returns an encrypted string."""
    return cipher_suite.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    """Takes an encrypted string and returns the raw API key."""
    return cipher_suite.decrypt(encrypted_key.encode()).decode()