#!/bin/sh
# Runs inside the ipfs/kubo container before the daemon starts (container-init.d).
# unixfs-v1-2025: CIDv1, raw leaves, 1 MiB chunks -- the IPFS docs default for
# scientific data, and the same CIDs meshkit0 computes on its S3 path.
set -e
ipfs config profile apply unixfs-v1-2025
