#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * 
 * Validates that all required environment variables are set before deployment.
 * Run this before building Docker images or deploying to production.
 * 
 * Usage:
 *   node scripts/validate-env.js
 *   npm run validate:env
 */

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'VITE_GOOGLE_CLIENT_ID',
  'VITE_GOOGLE_MAPS_API_KEY',
];

const OPTIONAL_ENV_VARS = [
  'SENDGRID_API_KEY',
  'OPENAI_API_KEY',
  'AVIATION_STACK_API_KEY',
  'BASE_URL',
  'PORT',
  'NODE_ENV',
];

const DEPLOYMENT_ENV_VARS = {
  'Cloud Run': ['BASE_URL'],
  'Docker': [],
  'Replit': ['REPL_ID', 'REPL_SLUG', 'REPLIT_CLUSTER'],
};

function validateEnvironment() {
  console.log('🔍 Validating Environment Variables...\n');
  
  const missing = [];
  const present = [];
  const optionalPresent = [];
  
  // Check required variables
  console.log('📋 Required Variables:');
  REQUIRED_ENV_VARS.forEach(envVar => {
    const value = process.env[envVar];
    if (!value) {
      missing.push(envVar);
      console.log(`  ❌ ${envVar} - MISSING`);
    } else {
      present.push(envVar);
      const displayValue = envVar.includes('SECRET') || envVar.includes('KEY') || envVar.includes('PASSWORD')
        ? '***' + value.slice(-4)
        : value.substring(0, 30) + (value.length > 30 ? '...' : '');
      console.log(`  ✅ ${envVar} - ${displayValue}`);
    }
  });
  
  // Check optional variables
  console.log('\n🎯 Optional Variables (Enhanced Features):');
  OPTIONAL_ENV_VARS.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      optionalPresent.push(envVar);
      const displayValue = envVar.includes('SECRET') || envVar.includes('KEY') || envVar.includes('PASSWORD')
        ? '***' + value.slice(-4)
        : value.substring(0, 30) + (value.length > 30 ? '...' : '');
      console.log(`  ✅ ${envVar} - ${displayValue}`);
    } else {
      console.log(`  ⚪ ${envVar} - not set`);
    }
  });
  
  // Detect deployment environment
  console.log('\n🌍 Deployment Environment Detection:');
  if (process.env.REPL_ID || process.env.REPL_SLUG) {
    console.log('  📍 Detected: Replit Development');
  } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
    console.log('  📍 Detected: Google Cloud Run');
    if (!process.env.BASE_URL) {
      console.log('  ⚠️  WARNING: BASE_URL not set. OAuth callbacks may fail.');
      console.log('     Set BASE_URL to your Cloud Run service URL');
    }
  } else if (process.env.KUBERNETES_SERVICE_HOST) {
    console.log('  📍 Detected: Kubernetes');
  } else {
    console.log('  📍 Detected: Docker/Local');
  }
  
  // Validate specific configurations
  console.log('\n🔐 Security Checks:');
  
  // Check SESSION_SECRET strength
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret) {
    if (sessionSecret.length < 32) {
      console.log('  ⚠️  WARNING: SESSION_SECRET is shorter than 32 characters');
      console.log('     Generate a stronger secret with: openssl rand -base64 32');
    } else {
      console.log('  ✅ SESSION_SECRET length is adequate');
    }
  }
  
  // Check DATABASE_URL format
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      console.log('  ✅ DATABASE_URL format is valid');
    } else {
      console.log('  ❌ DATABASE_URL format is invalid (should start with postgresql://)');
      missing.push('DATABASE_URL (invalid format)');
    }
  }
  
  // Check NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production') {
    console.log('  ✅ NODE_ENV set to production');
  } else {
    console.log(`  ⚠️  NODE_ENV is "${nodeEnv || 'not set'}" (expected: production)`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Validation Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Required variables present: ${present.length}/${REQUIRED_ENV_VARS.length}`);
  console.log(`🎯 Optional variables present: ${optionalPresent.length}/${OPTIONAL_ENV_VARS.length}`);
  
  if (missing.length > 0) {
    console.log(`\n❌ Missing ${missing.length} required variable(s):`);
    missing.forEach(envVar => console.log(`   - ${envVar}`));
    console.log('\n💡 See ENVIRONMENT_VARIABLES.md for setup instructions');
    process.exit(1);
  } else {
    console.log('\n✅ All required environment variables are set!');
    console.log('🚀 Ready for deployment');
    
    if (optionalPresent.length < OPTIONAL_ENV_VARS.length) {
      console.log('\n💡 Optional features available with additional env vars:');
      OPTIONAL_ENV_VARS.forEach(envVar => {
        if (!process.env[envVar]) {
          const descriptions = {
            'SENDGRID_API_KEY': 'Email invitations for trip participants',
            'OPENAI_API_KEY': 'AI-powered event parsing and recommendations',
            'AVIATION_STACK_API_KEY': 'Flight information lookup',
            'BASE_URL': 'Custom base URL for OAuth callbacks',
          };
          if (descriptions[envVar]) {
            console.log(`   - ${envVar}: ${descriptions[envVar]}`);
          }
        }
      });
    }
    
    process.exit(0);
  }
}

// Run validation
try {
  validateEnvironment();
} catch (error) {
  console.error('\n❌ Validation failed with error:');
  console.error(error.message);
  process.exit(1);
}
