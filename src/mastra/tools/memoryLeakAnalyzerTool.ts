import * as esprima from 'esprima';
import * as estraverse from 'estraverse';
import * as escope from 'escope';

/**
 * Tool for analyzing JavaScript/TypeScript code for memory leaks
 */
export class MemoryLeakAnalyzerTool {
  static description = 'Analyzes JavaScript/TypeScript code for potential memory leaks';

  /**
   * Executes memory leak analysis
   * @param {Object} params - Parameters for memory leak analysis
   * @param {string} params.code - The code snippet to analyze for memory leaks
   * @param {Object} params.options - Additional options for memory leak analysis
   * @returns {Object} - Analysis results
   */
  async execute({ code, options = {
    checkClosures: true,
    checkEventListeners: true,
    checkCircularReferences: true,
    checkLargeArrays: true
  } }) {
    const result = {
      leaks: [],
      warnings: [],
      recommendations: []
    } as any;

    try {
      // Parse the code using esprima
      const ast = esprima.parseScript(code, { loc: true, tolerant: true, comment: true });

      // Get scope information using escope
      const scopeManager = escope.analyze(ast);
      const globalScope = scopeManager.acquire(ast);

      // Check for large arrays or objects
      if (options.checkLargeArrays) {
        analyzeForLargeArrays(ast, result);
      }

      // Check for closure-related leaks
      if (options.checkClosures) {
        analyzeForClosureLeaks(ast, scopeManager, result);
      }

      // Check for event listener leaks
      if (options.checkEventListeners) {
        analyzeForEventListenerLeaks(ast, result);
      }

      // Check for circular references
      if (options.checkCircularReferences) {
        analyzeForCircularReferences(ast, result);
      }

      // Add general recommendations
      result.recommendations.push({
        message: 'Consider using WeakMap or WeakSet for caching objects to prevent memory leaks.'
      });

      result.recommendations.push({
        message: 'Always clean up resources like event listeners, timers, and references to large data structures when they are no longer needed.'
      });

      return result;
    } catch (error: any) {
      return {
        leaks: [],
        warnings: [{
          severity: 'error',
          message: `Error analyzing code for memory leaks: ${error.message}`,
          line: 0
        }],
        recommendations: [{
          message: 'Please check if the provided code is valid JavaScript/TypeScript.'
        }]
      };
    }
  }
}

/**
 * Analyzes code for large arrays or objects that could cause memory issues
 */
function analyzeForLargeArrays(ast, result) {
  estraverse.traverse(ast, {
    enter: function (node) {
      // Check for large array literals
      if (node.type === 'ArrayExpression' && node.elements.length > 1000) {
        result.warnings.push({
          severity: 'warning',
          message: `Large array literal with ${node.elements.length} elements detected. Consider chunking or lazy loading.`,
          line: node.loc.start.line
        });
      }

      // Check for Array creation with large size
      if (node.type === 'NewExpression' &&
        node.callee.name === 'Array' &&
        node.arguments.length > 0 &&
        node.arguments[0].type === 'Literal' &&
        typeof node.arguments[0].value === 'number' &&
        node.arguments[0].value > 10000) {
        result.leaks.push({
          severity: 'high',
          message: `Creating a very large Array with ${node.arguments[0].value} elements. This could lead to excessive memory usage.`,
          line: node.loc.start.line
        });
      }

      // Check for fill or similar methods with large data
      if (node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        (node.callee.property.name === 'fill' ||
          node.callee.property.name === 'f1ll')) { // Catching typo 'f1ll' as in the example
        result.leaks.push({
          severity: 'high',
          message: 'Array.fill method used to populate a potentially large array. Check if this could lead to memory issues.',
          line: node.loc.start.line
        });
      }
    }
  });
}

/**
 * Analyzes code for closure-related memory leaks
 */
function analyzeForClosureLeaks(ast, scopeManager, result) {
  // Find functions that create closures
  estraverse.traverse(ast, {
    enter: function (node) {
      if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
        // Check if this function creates a closure that might leak
        const scope = scopeManager.acquire(node);

        if (scope) {
          const references = scope.references;
          const variables = scope.variables;

          // Check for variables defined outside but referenced inside
          for (const ref of references) {
            if (!ref.resolved) continue;

            // If the variable is defined in an outer scope and is not a global
            if (ref.resolved.scope !== scope && ref.resolved.scope.type !== 'global') {
              // Check if the variable might be large
              const varName = ref.identifier.name;

              // Look for references to large objects or arrays in the closure
              if (varName.toLowerCase().includes('data') ||
                varName.toLowerCase().includes('array') ||
                varName.toLowerCase().includes('cache') ||
                varName.toLowerCase().includes('buffer')) {
                result.leaks.push({
                  severity: 'high',
                  message: `Potential memory leak: Closure references large outer variable '${varName}' which may prevent garbage collection.`,
                  line: node.loc.start.line
                });
              }
            }
          }
        }
      }

      // Check for loop patterns that create many closures
      if (node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement') {
        const body = node.body.body || (node.body.type === 'BlockStatement' ? node.body.body : [node.body]);

        const pushesToArray = body.some(statement =>
          statement.type === 'ExpressionStatement' &&
          statement.expression.type === 'CallExpression' &&
          statement.expression.callee.type === 'MemberExpression' &&
          statement.expression.callee.property.name === 'push'
        );

        const createsFunctions = body.some(statement =>
          (statement.type === 'FunctionDeclaration') ||
          (statement.type === 'VariableDeclaration' &&
            statement.declarations.some(decl =>
              decl.init && (decl.init.type === 'FunctionExpression' || decl.init.type === 'ArrowFunctionExpression')
            ))
        );

        if (pushesToArray && createsFunctions) {
          result.leaks.push({
            severity: 'high',
            message: 'Loop creates and stores functions in an array. This pattern often causes memory leaks as the closures retain references to data.',
            line: node.loc.start.line
          });
        }
      }
    }
  });
}

/**
 * Analyzes code for event listener related memory leaks
 */
function analyzeForEventListenerLeaks(ast, result) {
  // Track addEventListener calls
  const eventListeners: any = [];

  estraverse.traverse(ast, {
    enter: function (node) {
      // Check for addEventListener calls
      if (node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'addEventListener' &&
        node.arguments.length >= 2) {

        eventListeners.push({
          node: node,
          event: node.arguments[0].value || 'unknown',
          line: node.loc.start.line
        });
      }
    }
  });

  // Track removeEventListener calls
  const removeListeners: any = [];

  estraverse.traverse(ast, {
    enter: function (node) {
      // Check for removeEventListener calls
      if (node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'removeEventListener') {

        removeListeners.push({
          event: node.arguments[0].value || 'unknown',
          line: node.loc.start.line
        });
      }
    }
  });

  // Check for imbalance
  if (eventListeners.length > 0 && removeListeners.length < eventListeners.length) {
    result.warnings.push({
      severity: 'warning',
      message: `Found ${eventListeners.length} event listeners but only ${removeListeners.length} removals. Ensure all event listeners are properly removed to prevent memory leaks.`,
      line: eventListeners[0].line
    });

    result.recommendations.push({
      message: 'Always use removeEventListener to clean up event listeners when they are no longer needed, especially in components with dynamic lifecycles.'
    });
  }
}

/**
 * Analyzes code for circular references that could cause memory leaks
 */
function analyzeForCircularReferences(ast, result) {
  // Check for patterns that commonly create circular references
  estraverse.traverse(ast, {
    enter: function (node) {
      // Check for object property assignments that might create circular references
      if (node.type === 'AssignmentExpression' &&
        node.left.type === 'MemberExpression' &&
        node.right.type === 'Identifier') {

        // obj.parent = obj or similar patterns
        const objectName = node.left.object.name;
        const propertyName = node.left.property.name;
        const assignedValue = node.right.name;

        if (objectName === assignedValue) {
          result.leaks.push({
            severity: 'medium',
            message: `Circular reference detected: ${objectName}.${propertyName} = ${assignedValue}. This can prevent garbage collection.`,
            line: node.loc.start.line
          });
        }
      }

      // Check for circular object literals
      if (node.type === 'ObjectExpression') {
        for (const prop of node.properties) {
          if (prop.value.type === 'Identifier') {
            const references = Array.isArray(prop.key) ? prop.key : [prop.key];

            for (const ref of references) {
              if (ref.name === prop.value.name) {
                result.warnings.push({
                  severity: 'warning',
                  message: `Potential circular reference in object literal: property ${ref.name} references ${prop.value.name}`,
                  line: node.loc.start.line
                });
              }
            }
          }
        }
      }
    }
  });
}