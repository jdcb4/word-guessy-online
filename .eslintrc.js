module.exports = {
  // ... your other ESLint config
  rules: {
    // Disable unused variable checks
    "@typescript-eslint/no-unused-vars": "off",
    
    // Allow 'any' type
    "@typescript-eslint/no-explicit-any": "off",
    
    // Allow unescaped entities in JSX
    "react/no-unescaped-entities": "off"
  }
} 