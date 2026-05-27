from cryptography.fernet import Fernet
from config import settings

cipher_suite = Fernet(settings.master_encryption_key.encode())

def encrypt_key(plain_text_key: str) -> str:
    """Encrypts a string and returns the cipher text."""
    return cipher_suite.encrypt(plain_text_key.encode()).decode()

def decrypt_key(cipher_text: str) -> str:
    """Decrypts a cipher text back to the plaintext string."""
    return cipher_suite.decrypt(cipher_text.encode()).decode()

def generate_key_preview(plain_text_key: str) -> str:
    """Creates a masked preview (e.g. AIza...8f9a) for the UI."""
    if len(plain_text_key) > 8:
        return f"{plain_text_key[:4]}...{plain_text_key[-4:]}"
    return "****"