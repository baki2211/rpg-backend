#!/usr/bin/env node

import https from 'https';

const BACKEND_URL = 'https://arcanerealms.org';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = `${BACKEND_URL}${path}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            resolve({ error: `HTTP ${res.statusCode}`, body: data });
          }
        } catch (e) {
          resolve({ error: 'Parse error', body: data });
        }
      });
    }).on('error', reject);
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function checkResources() {
  console.log('Checking Backend Resource Usage...');
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
      const memUsed = health.memory.used; // Already in MB
      const memTotal = health.memory.total; // Already in MB
      const memRSS = health.memory.rss; // Already in MB
      const memExternal = health.memory.external; // Already in MB
      
      const starterLimit = 512; // MB
      const usagePercent = ((memRSS / starterLimit) * 100).toFixed(1);
      
      console.log('\nMEMORY ANALYSIS:');
      console.log(`   RSS (Real Memory): ${memRSS}MB / ${starterLimit}MB (${usagePercent}%)`);
      console.log(`   Heap Used: ${memUsed}MB`);
      console.log(`   Heap Total: ${memTotal}MB`);
      console.log(`   External: ${memExternal}MB`);
      
      // Memory status assessment
      if (memRSS > 450) {
        console.log('   CRITICAL: Memory usage very high! (>87.5%)');
        console.log('   Consider upgrading to Standard plan (2GB RAM)');
      } else if (memRSS > 400) {
        console.log('    WARNING: Memory usage high! (>78%)');
        console.log('   Monitor closely, consider optimizations');
      } else if (memRSS > 300) {
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
    console.log(`Connection Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log(' Backend may be spun down (auto-sleep after 15min idle)');
    } else if (error.code === 'ECONNREFUSED') {
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