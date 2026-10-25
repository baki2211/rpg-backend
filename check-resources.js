#!/usr/bin/env node

// Usage: node check-resources.js [baseUrl]
// The base URL comes from the first argument, then BACKEND_URL, then production.
// Example: node check-resources.js http://localhost:5001
const DEFAULT_BACKEND_URL = 'https://arcanerealms.org';
const BACKEND_URL = (process.argv[2] || process.env.BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/+$/, '');

// Global fetch (Node 18+) handles both http:// and https:// base URLs.
async function makeRequest(path) {
  const res = await fetch(`${BACKEND_URL}${path}`);
  const data = await res.text();
  try {
    if (res.status === 200) {
      return JSON.parse(data);
    }
    return { error: `HTTP ${res.status}`, body: data };
  } catch (e) {
    return { error: 'Parse error', body: data };
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function checkResources() {
  console.log(`Checking Backend Resource Usage at ${BACKEND_URL}...`);
  console.log('═'.repeat(60));
  console.log(`Your Plan: Starter (512MB RAM, 0.5 CPU)`);
  console.log('═'.repeat(60));

  try {
    // First, wake up the service if it's sleeping
    console.log('Waking up service...');
    await makeRequest('/api/health');
    
    // Wait a moment for metrics to populate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const health = await makeRequest('/api/health');
    
    if (health.error) {
      console.log(`Health Check Failed: ${health.error}`);
      return;
    }

    console.log(`Service Status: ${health.status}`);
    console.log(`Last Check: ${new Date(health.timestamp).toLocaleString()}`);
    
    if (health.memory) {
      const memUsed = health.memory.heap_used_mb;
      const memTotal = health.memory.heap_total_mb;
      const memRSS = health.memory.rss_mb;
      const limit = health.memory.limit_mb; // the server's RSS budget (RSS_BUDGET_BYTES)
      const usagePercent = health.memory.usage_percent;
      
      console.log('\nMEMORY ANALYSIS:');
      console.log(`   RSS (Real Memory): ${memRSS}MB / ${limit}MB (${usagePercent}%)`);
      console.log(`   Heap Used: ${memUsed}MB`);
      console.log(`   Heap Total: ${memTotal}MB`);
      console.log(`   Server memory status: ${health.memory.status} (manager: ${health.memory.manager_status})`);
      
      // Memory status assessment
      if (usagePercent > 87.5) {
        console.log('   CRITICAL: Memory usage very high! (>87.5%)');
        console.log('   Consider upgrading to Standard plan (2GB RAM)');
      } else if (usagePercent > 78) {
        console.log('    WARNING: Memory usage high! (>78%)');
        console.log('   Monitor closely, consider optimizations');
      } else if (usagePercent > 58) {
        console.log('    CAUTION: Memory usage moderate (>58%)');
        console.log('   Room for growth but watch trends');
      } else {
        console.log(' Memory usage looks healthy');
      }
    }

    if (health.connections) {
      const presenceConn = health.connections.presence || 0;
      const chatConn = health.connections.chat || 0;
      const totalConn = presenceConn + chatConn;
      
      console.log('\n CONNECTION ANALYSIS:');
      console.log(`   Presence WebSocket: ${presenceConn} connections`);
      console.log(`   Chat WebSocket: ${chatConn} connections`);
      console.log(`   Total Active: ${totalConn} connections`);
      
      // Connection limits we set
      console.log(`   Limits: Presence(50), Chat(100), Per-Location(20)`);
      
      if (totalConn > 80) {
        console.log('     High connection count - may impact performance');
      } else if (totalConn > 50) {
        console.log('     Moderate connection count - monitor closely');
      } else {
        console.log('   Connection count looks normal');
      }
    }

    if (health.uptime) {
      const uptimeHours = (health.uptime / 3600).toFixed(1);
      const uptimeDays = (health.uptime / 86400).toFixed(1);
      
      console.log(`\nUPTIME: ${uptimeHours} hours (${uptimeDays} days)`);
      
      if (health.uptime < 300) {
        console.log('    Service recently restarted');
      }
    }

    // Check for warnings
    if (health.warning) {
      console.log(`\n SERVER WARNING: ${health.warning}`);
    }

  } catch (error) {
    // fetch wraps the network error: its code is on error.cause
    const code = error.cause?.code ?? error.code;
    console.log(`Connection Error: ${error.cause?.message ?? error.message}`);
    
    if (code === 'ENOTFOUND') {
      console.log(' Backend may be spun down (auto-sleep after 15min idle)');
    } else if (code === 'ECONNREFUSED') {
      console.log(' Connection refused - service may be restarting');
    }
  }

  console.log('\nOPTIMIZATION TIPS:');
  console.log('   • Your Starter plan (512MB/0.5CPU) is good for moderate traffic');
  console.log('   • WebSocket connections are limited to prevent overload');
  console.log('   • Memory compression and cleanup are active');
  console.log('   • Consider Standard plan (2GB/1CPU) if consistently >400MB');
  console.log('   • Monitor Render Dashboard → Metrics for detailed graphs');
  
  console.log('\nTROUBLESHOOTING:');
  console.log('   • "Insufficient resources" = hitting memory/CPU limits');
  console.log('   • Check for memory leaks in your application code');
  console.log('   • Reduce WebSocket message frequency if possible');
  console.log('   • Consider database query optimization');
}

checkResources().catch(console.error); 