import sys
import platform
platform.mac_ver = lambda: ("14.0.0", ("", "", ""), "arm64")
from pip._internal.cli.main import main
if __name__ == "__main__":
    sys.exit(main())
