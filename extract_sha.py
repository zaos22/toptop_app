import re

with open('sha1.txt', 'rb') as f:
    content = f.read().decode('utf-16le', errors='ignore')

sha1 = re.search(r'SHA1:\s+([0-9A-F:]+)', content)
sha256 = re.search(r'SHA256:\s+([0-9A-F:]+)', content)

if sha1:
    print(f"SHA1_FOUND: {sha1.group(1)}")
if sha256:
    print(f"SHA256_FOUND: {sha256.group(1)}")
