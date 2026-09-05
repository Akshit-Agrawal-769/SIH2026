import sys
import platform
platform.mac_ver = lambda: ('14.0.0', ('', '', ''), 'arm64')
import ensurepip
sys.exit(ensurepip._main())
