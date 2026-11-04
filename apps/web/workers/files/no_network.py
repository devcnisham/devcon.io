"""Deny IP sockets for the renderer process and its descendants (Linux container)."""
import errno
import os
import sys

# Debian's python3-seccomp lives outside the official Python image's site-packages.
sys.path.append('/usr/lib/python3/dist-packages')
import seccomp

policy = seccomp.SyscallFilter(defaction=seccomp.ALLOW)
# AF_INET and AF_INET6 are blocked; local Unix sockets needed by LibreOffice remain usable.
for family in (2, 10):
    policy.add_rule(seccomp.ERRNO(errno.EPERM), 'socket', seccomp.Arg(0, seccomp.EQ, family))
policy.load()
os.execvp(sys.argv[1], sys.argv[1:])
