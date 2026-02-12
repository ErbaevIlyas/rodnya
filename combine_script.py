#!/usr/bin/env python3
import subprocess
import sys

# Get the original file from git
result = subprocess.run(['git', 'show', 'HEAD:public/script.js'], 
                       capture_output=True, text=True, cwd='.')

if result.returncode != 0:
    print(f"Error: {result.stderr}")
    sys.exit(1)

lines = result.stdout.split('\n')
print(f"Total lines in original: {len(lines)}")

# Extract the two parts
part1 = lines[:1779]  # Lines 1-1779
part2 = lines[2252:]  # Lines 2253 onwards

print(f"Part 1 lines: {len(part1)}")
print(f"Part 2 lines: {len(part2)}")

# Combine
combined = part1 + part2

# Write to file
with open('public/script.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(combined))

print(f"File recreated with {len(combined)} lines")
