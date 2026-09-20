import os
import sys
from huggingface_hub import HfApi

token = "token"
repo_id = "ScaryCobra/incois"

api = HfApi()

try:
    print(f"Creating repository {repo_id}...")
    api.create_repo(repo_id=repo_id, token=token, repo_type="dataset", exist_ok=True)
    print("Repository is ready!")

    folder_path = r"D:\OneDrive\Desktop\sih26\SIH2026\datasets"
    print(f"Uploading datasets from {folder_path}...")
    
    # This function handles large files automatically
    api.upload_folder(
        folder_path=folder_path,
        repo_id=repo_id,
        repo_type="dataset",
        token=token,
        commit_message="Upload complete datasets folder"
    )
    print("Upload completed successfully!")
except Exception as e:
    print(f"An error occurred: {e}")
    sys.exit(1)
