from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "AF Trends API"
    jwt_secret: str = "af-trends-local-dev-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720
    database_url: str = "sqlite:///./af_trends.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
    media_dir: str = "media"
    seed_password: str = "trends123"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def media_path(self) -> Path:
        path = Path(self.media_dir)
        if not path.is_absolute():
            path = BASE_DIR / path
        return path


settings = Settings()
