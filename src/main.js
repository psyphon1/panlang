// panlang/src/main.js
// The core interpreter for the PanLang language

const fs = require('fs');
const path = require('path');

// Basic PanLang AST Node Types
const AST_TYPES = {
    PROGRAM: 'Program',
    VARIABLE_DECLARATION: 'VariableDeclaration',
    IDENTIFIER: 'Identifier',
    NUMERIC_LITERAL: 'NumericLiteral',
    STRING_LITERAL: 'StringLiteral',
    BOOLEAN_LITERAL: 'BooleanLiteral',
    BINARY_EXPRESSION: 'BinaryExpression',
    UNARY_EXPRESSION: 'UnaryExpression',
    ASSIGNMENT_EXPRESSION: 'AssignmentExpression',
    CALL_EXPRESSION: 'CallExpression',
    MEMBER_EXPRESSION: 'MemberExpression',
    IF_STATEMENT: 'IfStatement',
    WHILE_STATEMENT: 'WhileStatement',
    FOR_STATEMENT: 'ForStatement',
    BLOCK_STATEMENT: 'BlockStatement',
    PRINT_STATEMENT: 'PrintStatement',
    FUNCTION_DECLARATION: 'FunctionDeclaration',
    RETURN_STATEMENT: 'ReturnStatement',
    ARRAY_LITERAL: 'ArrayLiteral',
    OBJECT_LITERAL: 'ObjectLiteral',
    PROPERTY: 'Property',
};

// --- Lexer (Tokenization) ---
class Lexer {
    constructor(input) {
        this.input = input;
        this.cursor = 0;
        this.tokens = [];
    }

    tokenize() {
        const keywords = ['let', 'if', 'else', 'while', 'for', 'function', 'return', 'true', 'false', 'print'];
        const operators = ['+', '-', '*', '/', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!'];
        const delimiters = ['(', ')', '{', '}', '[', ']', ',', ';', '.'];

        while (this.cursor < this.input.length) {
            let char = this.input[this.cursor];

            // Skip whitespace
            if (/\s/.test(char)) {
                this.cursor++;
                continue;
            }

            // Handle comments (single-line: //)
            if (char === '/' && this.input[this.cursor + 1] === '/') {
                while (char && char !== '\n') {
                    this.cursor++;
                    char = this.input[this.cursor];
                }
                continue; // Continue to next token after skipping comment
            }

            // Handle numbers
            if (/\d/.test(char)) {
                let value = '';
                while (/\d/.test(char) || char === '.') {
                    value += char;
                    this.cursor++;
                    char = this.input[this.cursor];
                }
                this.tokens.push({ type: 'NUMBER', value: parseFloat(value) });
                continue;
            }

            // Handle strings (single or double quotes)
            if (char === '\'' || char === '"') {
                const quoteType = char;
                let value = '';
                this.cursor++; // Skip opening quote
                char = this.input[this.cursor];
                while (char && char !== quoteType) {
                    value += char;
                    this.cursor++;
                    char = this.input[this.cursor];
                }
                if (char !== quoteType) {
                    throw new Error(`Syntax Error: Unclosed string literal at position ${this.cursor}.`);
                }
                this.cursor++; // Skip closing quote
                this.tokens.push({ type: 'STRING', value: value });
                continue;
            }

            // Handle identifiers and keywords
            if (/[a-zA-Z_]/.test(char)) {
                let value = '';
                while (/[a-zA-Z0-9_]/.test(char)) {
                    value += char;
                    this.cursor++;
                    char = this.input[this.cursor];
                }
                if (keywords.includes(value)) {
                    this.tokens.push({ type: value.toUpperCase(), value: value });
                } else {
                    this.tokens.push({ type: 'IDENTIFIER', value: value });
                }
                continue;
            }

            // Handle operators (multi-character first for '==', '!=', etc.)
            let matchedOperator = false;
            for (const op of operators.sort((a, b) => b.length - a.length)) { // Sort by length descending
                if (this.input.substring(this.cursor, this.cursor + op.length) === op) {
                    this.tokens.push({ type: 'OPERATOR', value: op });
                    this.cursor += op.length;
                    matchedOperator = true;
                    break;
                }
            }
            if (matchedOperator) continue;

            // Handle delimiters
            if (delimiters.includes(char)) {
                this.tokens.push({ type: 'DELIMITER', value: char });
                this.cursor++;
                continue;
            }

            throw new Error(`Syntax Error: Unexpected character '${char}' at position ${this.cursor}.`);
        }

        this.tokens.push({ type: 'EOF', value: 'EOF' }); // End Of File token
        return this.tokens;
    }
}

// --- Parser (AST Construction) ---
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.cursor = 0;
    }

    peek(offset = 0) {
        return this.tokens[this.cursor + offset];
    }

    consume(expectedType = null, expectedValue = null) {
        const token = this.tokens[this.cursor];
        if (expectedType && token.type !== expectedType) {
            throw new Error(`Parse Error: Expected ${expectedType}, but got ${token.type} (${token.value}).`);
        }
        if (expectedValue && token.value !== expectedValue) {
            throw new Error(`Parse Error: Expected value ${expectedValue}, but got ${token.value}.`);
        }
        this.cursor++;
        return token;
    }

    isEOF() {
        return this.peek().type === 'EOF';
    }

    parse() {
        const body = [];
        while (!this.isEOF()) {
            body.push(this.parseStatement());
        }
        return {
            type: AST_TYPES.PROGRAM,
            body: body
        };
    }

    parseStatement() {
        const token = this.peek();
        switch (token.type) {
            case 'LET':
                return this.parseVariableDeclaration();
            case 'IF':
                return this.parseIfStatement();
            case 'WHILE':
                return this.parseWhileStatement();
            case 'FOR':
                return this.parseForStatement();
            case 'FUNCTION':
                return this.parseFunctionDeclaration();
            case 'RETURN':
                return this.parseReturnStatement();
            case 'PRINT':
                return this.parsePrintStatement();
            case 'DELIMITER': // Handle block statements starting with '{'
                if (token.value === '{') {
                    return this.parseBlockStatement();
                }
                // Fall through for other delimiters if they appear unexpectedly
            default:
                // Assume it's an expression statement (e.g., assignment or function call)
                const expr = this.parseExpression();
                this.consume('DELIMITER', ';'); // Statements must end with a semicolon
                return expr;
        }
    }

    parseVariableDeclaration() {
        this.consume('LET');
        const identifier = this.consume('IDENTIFIER');
        this.consume('OPERATOR', '=');
        const value = this.parseExpression();
        this.consume('DELIMITER', ';');
        return {
            type: AST_TYPES.VARIABLE_DECLARATION,
            identifier: { type: AST_TYPES.IDENTIFIER, name: identifier.value },
            value: value,
        };
    }

    parsePrintStatement() {
        this.consume('PRINT');
        this.consume('DELIMITER', '(');
        const argument = this.parseExpression();
        this.consume('DELIMITER', ')');
        this.consume('DELIMITER', ';');
        return {
            type: AST_TYPES.PRINT_STATEMENT,
            argument: argument,
        };
    }

    parseFunctionDeclaration() {
        this.consume('FUNCTION');
        const name = this.consume('IDENTIFIER');
        this.consume('DELIMITER', '(');
        const params = [];
        if (this.peek().value !== ')') {
            do {
                params.push(this.consume('IDENTIFIER').value);
            } while (this.peek().value === ',' && this.consume('DELIMITER', ','));
        }
        this.consume('DELIMITER', ')');
        const body = this.parseBlockStatement(); // Function body is a block statement
        return {
            type: AST_TYPES.FUNCTION_DECLARATION,
            name: name.value,
            params: params,
            body: body,
        };
    }

    parseReturnStatement() {
        this.consume('RETURN');
        const argument = this.parseExpression();
        this.consume('DELIMITER', ';');
        return {
            type: AST_TYPES.RETURN_STATEMENT,
            argument: argument,
        };
    }

    parseIfStatement() {
        this.consume('IF');
        this.consume('DELIMITER', '(');
        const test = this.parseExpression();
        this.consume('DELIMITER', ')');
        const consequent = this.parseStatement(); // Can be a single statement or a block
        let alternate = null;
        if (this.peek().type === 'ELSE') {
            this.consume('ELSE');
            alternate = this.parseStatement();
        }
        return {
            type: AST_TYPES.IF_STATEMENT,
            test: test,
            consequent: consequent,
            alternate: alternate,
        };
    }

    parseWhileStatement() {
        this.consume('WHILE');
        this.consume('DELIMITER', '(');
        const test = this.parseExpression();
        this.consume('DELIMITER', ')');
        const body = this.parseStatement();
        return {
            type: AST_TYPES.WHILE_STATEMENT,
            test: test,
            body: body,
        };
    }

    parseForStatement() {
        this.consume('FOR');
        this.consume('DELIMITER', '(');
        const init = this.parseVariableDeclaration(); // For simplicity, only var declaration for now
        // Semicolon is consumed by parseVariableDeclaration
        const test = this.parseExpression();
        this.consume('DELIMITER', ';');
        const update = this.parseExpression(); // This will consume the trailing semicolon
        this.consume('DELIMITER', ')'); // This will consume the trailing semicolon
        const body = this.parseStatement();
        return {
            type: AST_TYPES.FOR_STATEMENT,
            init: init,
            test: test,
            update: update,
            body: body,
        };
    }

    parseBlockStatement() {
        this.consume('DELIMITER', '{');
        const body = [];
        while (this.peek().value !== '}') {
            body.push(this.parseStatement());
        }
        this.consume('DELIMITER', '}');
        return {
            type: AST_TYPES.BLOCK_STATEMENT,
            body: body,
        };
    }

    parseExpression() {
        return this.parseAssignmentExpression();
    }

    parseAssignmentExpression() {
        let left = this.parseLogicalOrExpression();
        if (this.peek().type === 'OPERATOR' && this.peek().value === '=') {
            const operator = this.consume('OPERATOR', '=').value;
            const right = this.parseAssignmentExpression(); // Right-associativity
            left = {
                type: AST_TYPES.ASSIGNMENT_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseLogicalOrExpression() {
        let left = this.parseLogicalAndExpression();
        while (this.peek().type === 'OPERATOR' && this.peek().value === '||') {
            const operator = this.consume().value;
            const right = this.parseLogicalAndExpression();
            left = {
                type: AST_TYPES.BINARY_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseLogicalAndExpression() {
        let left = this.parseEqualityExpression();
        while (this.peek().type === 'OPERATOR' && this.peek().value === '&&') {
            const operator = this.consume().value;
            const right = this.parseEqualityExpression();
            left = {
                type: AST_TYPES.BINARY_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseEqualityExpression() {
        let left = this.parseRelationalExpression();
        while (this.peek().type === 'OPERATOR' && (this.peek().value === '==' || this.peek().value === '!=')) {
            const operator = this.consume().value;
            const right = this.parseRelationalExpression();
            left = {
                type: AST_TYPES.BINARY_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseRelationalExpression() {
        let left = this.parseAdditiveExpression();
        while (this.peek().type === 'OPERATOR' && ['<', '>', '<=', '>='].includes(this.peek().value)) {
            const operator = this.consume().value;
            const right = this.parseAdditiveExpression();
            left = {
                type: AST_TYPES.BINARY_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseAdditiveExpression() {
        let left = this.parseMultiplicativeExpression();
        while (this.peek().type === 'OPERATOR' && (this.peek().value === '+' || this.peek().value === '-')) {
            const operator = this.consume().value;
            const right = this.parseMultiplicativeExpression();
            left = {
                type: AST_TYPES.BINARY_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseMultiplicativeExpression() {
        let left = this.parseUnaryExpression();
        while (this.peek().type === 'OPERATOR' && (this.peek().value === '*' || this.peek().value === '/')) {
            const operator = this.consume().value;
            const right = this.parseUnaryExpression();
            left = {
                type: AST_TYPES.BINARY_EXPRESSION,
                operator: operator,
                left: left,
                right: right,
            };
        }
        return left;
    }

    parseUnaryExpression() {
        if (this.peek().type === 'OPERATOR' && (this.peek().value === '-' || this.peek().value === '!')) {
            const operator = this.consume().value;
            const argument = this.parseUnaryExpression(); // Unary operators are right-associative
            return {
                type: AST_TYPES.UNARY_EXPRESSION,
                operator: operator,
                argument: argument,
            };
        }
        return this.parsePrimaryExpression();
    }

    parsePrimaryExpression() {
        let expr = this.parseAtomicExpression();

        while (true) {
            const nextToken = this.peek();
            if (nextToken.type === 'DELIMITER' && nextToken.value === '(') {
                expr = this.parseCallExpression(expr);
            } else if (nextToken.type === 'DELIMITER' && nextToken.value === '[') {
                expr = this.parseMemberExpression(expr);
            } else if (nextToken.type === 'DELIMITER' && nextToken.value === '.') {
                expr = this.parseMemberExpression(expr);
            }
            else {
                break;
            }
        }
        return expr;
    }

    parseCallExpression(callee) {
        this.consume('DELIMITER', '(');
        const args = [];
        if (this.peek().value !== ')') {
            do {
                args.push(this.parseExpression());
            } while (this.peek().value === ',' && this.consume('DELIMITER', ','));
        }
        this.consume('DELIMITER', ')');
        return {
            type: AST_TYPES.CALL_EXPRESSION,
            callee: callee,
            arguments: args,
        };
    }

    parseMemberExpression(object) {
        if (this.peek().value === '.') {
            this.consume('DELIMITER', '.');
            const property = this.consume('IDENTIFIER');
            return {
                type: AST_TYPES.MEMBER_EXPRESSION,
                object: object,
                property: { type: AST_TYPES.IDENTIFIER, name: property.value },
                computed: false, // . is not computed
            };
        } else if (this.peek().value === '[') {
            this.consume('DELIMITER', '[');
            const property = this.parseExpression(); // Expression for array index or object key
            this.consume('DELIMITER', ']');
            return {
                type: AST_TYPES.MEMBER_EXPRESSION,
                object: object,
                property: property,
                computed: true, // [] is computed
            };
        }
        throw new Error("Parse Error: Invalid member expression.");
    }

    parseAtomicExpression() {
        const token = this.peek();
        switch (token.type) {
            case 'NUMBER':
                return { type: AST_TYPES.NUMERIC_LITERAL, value: this.consume().value };
            case 'STRING':
                return { type: AST_TYPES.STRING_LITERAL, value: this.consume().value };
            case 'TRUE':
                this.consume();
                return { type: AST_TYPES.BOOLEAN_LITERAL, value: true };
            case 'FALSE':
                this.consume();
                return { type: AST_TYPES.BOOLEAN_LITERAL, value: false };
            case 'IDENTIFIER':
                return { type: AST_TYPES.IDENTIFIER, name: this.consume().value };
            case 'DELIMITER':
                if (token.value === '(') {
                    this.consume('DELIMITER', '(');
                    const expr = this.parseExpression();
                    this.consume('DELIMITER', ')');
                    return expr;
                }
                if (token.value === '[') {
                    return this.parseArrayLiteral();
                }
                if (token.value === '{') {
                    return this.parseObjectLiteral();
                }
            default:
                throw new Error(`Parse Error: Unexpected token ${token.type} (${token.value}) in primary expression.`);
        }
    }

    parseArrayLiteral() {
        this.consume('DELIMITER', '[');
        const elements = [];
        if (this.peek().value !== ']') {
            do {
                elements.push(this.parseExpression());
            } while (this.peek().value === ',' && this.consume('DELIMITER', ','));
        }
        this.consume('DELIMITER', ']');
        return {
            type: AST_TYPES.ARRAY_LITERAL,
            elements: elements,
        };
    }

    parseObjectLiteral() {
        this.consume('DELIMITER', '{');
        const properties = [];
        if (this.peek().value !== '}') {
            do {
                const keyToken = this.consume('IDENTIFIER');
                this.consume('DELIMITER', ':');
                const value = this.parseExpression();
                properties.push({
                    type: AST_TYPES.PROPERTY,
                    key: { type: AST_TYPES.IDENTIFIER, name: keyToken.value }, // Keys are always identifiers for simplicity
                    value: value,
                });
            } while (this.peek().value === ',' && this.consume('DELIMITER', ','));
        }
        this.consume('DELIMITER', '}');
        return {
            type: AST_TYPES.OBJECT_LITERAL,
            properties: properties,
        };
    }
}

// --- Interpreter (AST Traversal and Execution) ---
class Interpreter {
    constructor() {
        this.scope = {}; // Global scope
        this.callStack = []; // For function calls
    }

    // Pushes a new scope onto the call stack
    pushScope(newScope) {
        this.callStack.push(this.scope);
        this.scope = { ...this.scope, ...newScope }; // Inherit parent scope
    }

    // Pops the current scope from the call stack
    popScope() {
        this.scope = this.callStack.pop();
    }

    // Resolves a variable in the current or parent scopes
    resolveVariable(name) {
        if (this.scope.hasOwnProperty(name)) {
            return this.scope[name];
        }
        // If not in current scope, check parent scopes in the call stack
        for (let i = this.callStack.length - 1; i >= 0; i--) {
            if (this.callStack[i].hasOwnProperty(name)) {
                return this.callStack[i][name];
            }
        }
        throw new Error(`Runtime Error: Undefined variable '${name}'.`);
    }

    // Assigns a value to a variable in the appropriate scope
    assignVariable(name, value) {
        if (this.scope.hasOwnProperty(name)) {
            this.scope[name] = value;
            return;
        }
        // If not in current scope, try to assign in parent scopes
        for (let i = this.callStack.length - 1; i >= 0; i--) {
            if (this.callStack[i].hasOwnProperty(name)) {
                this.callStack[i][name] = value;
                return;
            }
        }
        // If it doesn't exist in any scope, declare it in the current scope
        this.scope[name] = value;
    }

    interpret(node) {
        switch (node.type) {
            case AST_TYPES.PROGRAM:
                let lastResult = null;
                for (const statement of node.body) {
                    lastResult = this.interpret(statement);
                }
                return lastResult; // Return the result of the last statement
            case AST_TYPES.VARIABLE_DECLARATION:
                const varName = node.identifier.name;
                const varValue = this.interpret(node.value);
                this.scope[varName] = varValue;
                return varValue;
            case AST_TYPES.PRINT_STATEMENT:
                console.log(this.interpret(node.argument));
                return null; // Print statements don't return a value to the interpreter
            case AST_TYPES.NUMERIC_LITERAL:
            case AST_TYPES.STRING_LITERAL:
            case AST_TYPES.BOOLEAN_LITERAL:
                return node.value;
            case AST_TYPES.IDENTIFIER:
                return this.resolveVariable(node.name);
            case AST_TYPES.BINARY_EXPRESSION:
                const left = this.interpret(node.left);
                const right = this.interpret(node.right);
                switch (node.operator) {
                    case '+': return left + right;
                    case '-': return left - right;
                    case '*': return left * right;
                    case '/':
                        if (right === 0) throw new Error("Runtime Error: Division by zero.");
                        return left / right;
                    case '==': return left === right;
                    case '!=': return left !== right;
                    case '<': return left < right;
                    case '>': return left > right;
                    case '<=': return left <= right;
                    case '>=': return left >= right;
                    case '&&': return left && right;
                    case '||': return left || right;
                    default: throw new Error(`Runtime Error: Unknown binary operator ${node.operator}.`);
                }
            case AST_TYPES.UNARY_EXPRESSION:
                const arg = this.interpret(node.argument);
                switch (node.operator) {
                    case '-': return -arg;
                    case '!': return !arg;
                    default: throw new Error(`Runtime Error: Unknown unary operator ${node.operator}.`);
                }
            case AST_TYPES.ASSIGNMENT_EXPRESSION:
                // Handle assignments to identifiers and member expressions
                if (node.left.type === AST_TYPES.IDENTIFIER) {
                    const varName = node.left.name;
                    const value = this.interpret(node.right);
                    this.assignVariable(varName, value);
                    return value;
                } else if (node.left.type === AST_TYPES.MEMBER_EXPRESSION) {
                    const object = this.interpret(node.left.object);
                    const property = node.left.computed ? this.interpret(node.left.property) : node.left.property.name;
                    const value = this.interpret(node.right);

                    if (typeof object !== 'object' || object === null) {
                        throw new Error(`Runtime Error: Cannot assign to property '${property}' of non-object value.`);
                    }
                    object[property] = value;
                    return value;
                }
                throw new Error("Runtime Error: Invalid assignment target.");
            case AST_TYPES.IF_STATEMENT:
                if (this.interpret(node.test)) {
                    return this.interpret(node.consequent);
                } else if (node.alternate) {
                    return this.interpret(node.alternate);
                }
                return null;
            case AST_TYPES.WHILE_STATEMENT:
                let loopResult = null;
                while (this.interpret(node.test)) {
                    loopResult = this.interpret(node.body);
                }
                return loopResult;
            case AST_TYPES.FOR_STATEMENT:
                this.interpret(node.init); // Initialize loop variable
                let forLoopResult = null;
                while (this.interpret(node.test)) { // Test condition
                    forLoopResult = this.interpret(node.body); // Execute body
                    this.interpret(node.update); // Update expression
                }
                return forLoopResult;
            case AST_TYPES.BLOCK_STATEMENT:
                // Create a new scope for the block, execute statements, then restore previous scope
                this.pushScope({}); // Blocks create new lexical scopes
                let blockResult = null;
                for (const statement of node.body) {
                    blockResult = this.interpret(statement);
                    // Handle return statements that might exit the current function
                    if (statement.type === AST_TYPES.RETURN_STATEMENT) {
                        this.popScope(); // Ensure scope is popped on return
                        return blockResult;
                    }
                }
                this.popScope();
                return blockResult;
            case AST_TYPES.FUNCTION_DECLARATION:
                const funcName = node.name;
                const func = (...args) => {
                    const funcScope = {};
                    if (args.length !== node.params.length) {
                        throw new Error(`Runtime Error: Function '${funcName}' called with ${args.length} arguments, but expects ${node.params.length}.`);
                    }
                    node.params.forEach((param, index) => {
                        funcScope[param] = args[index];
                    });
                    this.pushScope(funcScope);
                    let returnValue = this.interpret(node.body);
                    this.popScope();
                    return returnValue;
                };
                this.scope[funcName] = func;
                return func;
            case AST_TYPES.CALL_EXPRESSION:
                const callee = this.interpret(node.callee);
                if (typeof callee !== 'function') {
                    throw new Error(`Runtime Error: Cannot call non-function value.`);
                }
                const callArgs = node.arguments.map(arg => this.interpret(arg));
                return callee(...callArgs);
            case AST_TYPES.ARRAY_LITERAL:
                return node.elements.map(element => this.interpret(element));
            case AST_TYPES.OBJECT_LITERAL:
                const obj = {};
                for (const prop of node.properties) {
                    obj[prop.key.name] = this.interpret(prop.value);
                }
                return obj;
            case AST_TYPES.MEMBER_EXPRESSION:
                const objValue = this.interpret(node.object);
                const propValue = node.computed ? this.interpret(node.property) : node.property.name;
                if (typeof objValue !== 'object' || objValue === null) {
                    throw new Error(`Runtime Error: Cannot access property '${propValue}' of non-object value.`);
                }
                return objValue[propValue];
            case AST_TYPES.RETURN_STATEMENT:
                return this.interpret(node.argument); // The value to return
            default:
                throw new Error(`Runtime Error: Unknown AST node type ${node.type}.`);
        }
    }
}

// --- Main execution logic ---
function executePanLang(code) {
    try {
        const lexer = new Lexer(code);
        const tokens = lexer.tokenize();
        // console.log("Tokens:", tokens); // For debugging

        const parser = new Parser(tokens);
        const ast = parser.parse();
        // console.log("AST:", JSON.stringify(ast, null, 2)); // For debugging

        const interpreter = new Interpreter();
        interpreter.interpret(ast);
    } catch (error) {
        console.error(`PanLang Error: ${error.message}`);
    }
}

// Check if a file path was provided as an argument
if (process.argv.length < 3) {
    console.log("Usage: panlang <filepath>");
    process.exit(1);
}

const filePath = process.argv[2];

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
    }
    executePanLang(data);
});
