path = r'C:\Users\someo\Documents\Codex\bounty_work\agentlily-runtime\.github\workflows\ci.yml'
with open(path, 'r') as f:
    c = f.read()
old = '          node-version: 20\n          cache: npm'
new = '          node-version: ${{ matrix.node-version }}\n          cache: npm\n    matrix:\n      node-version: [20, 22]'
c = c.replace(old, new)
with open(path, 'w') as f:
    f.write(c)
print('Fixed ci.yml')
