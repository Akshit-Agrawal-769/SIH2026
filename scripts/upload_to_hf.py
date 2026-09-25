"""
Upload the local datasets/ folder to a Hugging Face dataset repository.

  HF_TOKEN=<token> python scripts/upload_to_hf.py --repo <user>/<dataset>

The token is read from the environment only; never commit it.
"""
import argparse
import os
import sys

from huggingface_hub import HfApi

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True, help="dataset repo id, e.g. user/incois")
    ap.add_argument("--folder", default=os.path.join(REPO_ROOT, "datasets"))
    args = ap.parse_args()
    token = os.environ.get("HF_TOKEN")
    if not token:
        sys.exit("HF_TOKEN environment variable is not set")
    api = HfApi()
    api.create_repo(repo_id=args.repo, token=token, repo_type="dataset", exist_ok=True)
    api.upload_folder(folder_path=args.folder, repo_id=args.repo, repo_type="dataset", token=token,
                      commit_message="Upload datasets folder")
    print("Upload completed")


if __name__ == "__main__":
    main()
