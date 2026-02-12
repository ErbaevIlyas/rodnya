const fs = require('fs');
const { execSync } = require('child_process');

try {
  // Get original file from git
  const original = execSync('git show HEAD:public/script.js', { encoding: 'utf-8' });
  const lines = original.split('\n');
  
  console.log(`Total lines: ${lines.length}`);
  
  // Extract parts
  const part1 = lines.slice(0, 1779);
  const part2 = lines.slice(2252);
  
  console.log(`Part 1: ${part1.length} lines`);
  console.log(`Part 2: ${part2.length} lines`);
  
  // Combine
  const combined = [...part1, ...part2];
  
  // Write
  fs.writeFileSync('public/script.js', combined.join('\n'), 'utf-8');
  
  console.log(`File recreated: ${combined.length} lines`);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
