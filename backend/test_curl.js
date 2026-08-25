const http = require('http');

http.get('http://localhost:4000/api/accounts/tree', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const tree = JSON.parse(data);
      console.log('Tree received successfully. Top level nodes:', tree.length);

      function findAccount(nodes, name) {
        for (const n of nodes) {
          if (n.nameAr.includes(name)) return n;
          if (n.children) {
            const found = findAccount(n.children, name);
            if (found) return found;
          }
        }
        return null;
      }

      const ali = findAccount(tree, 'علي السعدي');
      const fly = findAccount(tree, 'سستم فلاي');

      console.log('--- ALI AL-SAADI NODE ---');
      console.log(JSON.stringify(ali, null, 2));

      console.log('--- SYSTEM FLY NODE ---');
      console.log(JSON.stringify(fly, null, 2));
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', console.error);
