#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h> // For isspace, isdigit, isalpha

// --- Token Definitions ---
typedef enum {
    TOKEN_NUMBER,
    TOKEN_STRING,
    TOKEN_IDENTIFIER,
    TOKEN_ASSIGN,   // =
    TOKEN_PLUS,     // +
    TOKEN_MINUS,    // -
    TOKEN_TIMES,    // *
    TOKEN_DIVIDE,   // /
    TOKEN_LPAREN,   // (
    TOKEN_RPAREN,   // )
    TOKEN_COMMA,    // ,
    TOKEN_COLON,    // :
    TOKEN_NEWLINE,  // \n
    TOKEN_PRINT,    // darshaya
    TOKEN_EOF,      // End of File
    // Add other tokens here as grammar expands (e.g., MODEL_DEF, IF_STMT etc.)
} TokenType;

typedef struct {
    TokenType type;
    char* value;
    int line;
    int column;
} Token;

// --- AST Node Definitions (Simplified) ---
typedef enum {
    NODE_NUMBER,
    NODE_STRING,
    NODE_VAR,
    NODE_BINOP,
    NODE_ASSIGN,
    NODE_PRINT,
    // Add other node types here as grammar expands
} NodeType;

typedef struct ASTNode {
    NodeType type;
    union {
        int number_val;
        char* string_val;
        char* var_name;
        struct {
            struct ASTNode* left;
            TokenType op;
            struct ASTNode* right;
        } bin_op;
        struct {
            char* var_name;
            struct ASTNode* expr;
        } assign_op;
        struct {
            struct ASTNode* expr;
        } print_stmt;
    } data;
} ASTNode;

// Function to create AST nodes
ASTNode* create_number_node(int value) {
    ASTNode* node = (ASTNode*)malloc(sizeof(ASTNode));
    node->type = NODE_NUMBER;
    node->data.number_val = value;
    return node;
}

ASTNode* create_string_node(char* value) {
    ASTNode* node = (ASTNode*)malloc(sizeof(ASTNode));
    node->type = NODE_STRING;
    // +1 for null terminator
    node->data.string_val = (char*)malloc(strlen(value) + 1);
    strcpy(node->data.string_val, value);
    return node;
}

ASTNode* create_var_node(char* name) {
    ASTNode* node = (ASTNode*)malloc(sizeof(ASTNode));
    node->type = NODE_VAR;
    node->data.var_name = (char*)malloc(strlen(name) + 1);
    strcpy(node->data.var_name, name);
    return node;
}

ASTNode* create_binop_node(ASTNode* left, TokenType op, ASTNode* right) {
    ASTNode* node = (ASTNode*)malloc(sizeof(ASTNode));
    node->type = NODE_BINOP;
    node->data.bin_op.left = left;
    node->data.bin_op.op = op;
    node->data.bin_op.right = right;
    return node;
}

ASTNode* create_assign_node(char* name, ASTNode* expr) {
    ASTNode* node = (ASTNode*)malloc(sizeof(ASTNode));
    node->type = NODE_ASSIGN;
    node->data.assign_op.var_name = (char*)malloc(strlen(name) + 1);
    strcpy(node->data.assign_op.var_name, name);
    node->data.assign_op.expr = expr;
    return node;
}

ASTNode* create_print_node(ASTNode* expr) {
    ASTNode* node = (ASTNode*)malloc(sizeof(ASTNode));
    node->type = NODE_PRINT;
    node->data.print_stmt.expr = expr;
    return node;
}

// Function to free AST nodes (important for memory management)
void free_ast_node(ASTNode* node) {
    if (!node) return;
    switch (node->type) {
        case NODE_NUMBER:
            break;
        case NODE_STRING:
            free(node->data.string_val);
            break;
        case NODE_VAR:
            free(node->data.var_name);
            break;
        case NODE_BINOP:
            free_ast_node(node->data.bin_op.left);
            free_ast_node(node->data.bin_op.right);
            break;
        case NODE_ASSIGN:
            free(node->data.assign_op.var_name);
            free_ast_node(node->data.assign_op.expr);
            break;
        case NODE_PRINT:
            free_ast_node(node->data.print_stmt.expr);
            break;
        default:
            break;
    }
    free(node);
}

// --- Lexer (Tokenizer) ---
typedef struct {
    const char* code;
    int pos;
    int line;
    int column;
    Token current_token;
} Lexer;

// Keywords lookup
typedef struct {
    const char* key;
    TokenType type;
} Keyword;

Keyword keywords[] = {
    {"darshaya", TOKEN_PRINT},
    // Add other keywords here
    {NULL, 0} // Sentinel
};

void lexer_init(Lexer* lexer, const char* code) {
    lexer->code = code;
    lexer->pos = 0;
    lexer->line = 1;
    lexer->column = 1;
    lexer->current_token.type = TOKEN_EOF; // Initialize to EOF
}

// Helper to advance position and column
void lexer_advance_char(Lexer* lexer) {
    if (lexer->pos < strlen(lexer->code)) {
        if (lexer->code[lexer->pos] == '\n') {
            lexer->line++;
            lexer->column = 1;
        } else {
            lexer->column++;
        }
        lexer->pos++;
    }
}

// Read a number token
Token lexer_read_number(Lexer* lexer) {
    int start_pos = lexer->pos;
    while (isdigit(lexer->code[lexer->pos])) {
        lexer_advance_char(lexer);
    }
    int len = lexer->pos - start_pos;
    char* value = (char*)malloc(len + 1);
    strncpy(value, lexer->code + start_pos, len);
    value[len] = '\0';
    return (Token){TOKEN_NUMBER, value, lexer->line, lexer->column - len};
}

// Read a string token
Token lexer_read_string(Lexer* lexer) {
    lexer_advance_char(lexer); // Consume opening quote
    int start_pos = lexer->pos;
    while (lexer->code[lexer->pos] != '"' && lexer->code[lexer->pos] != '\0') {
        lexer_advance_char(lexer);
    }
    int len = lexer->pos - start_pos;
    char* value = (char*)malloc(len + 3); // +2 for quotes, +1 for null terminator
    value[0] = '"';
    strncpy(value + 1, lexer->code + start_pos, len);
    value[len + 1] = '"';
    value[len + 2] = '\0';
    lexer_advance_char(lexer); // Consume closing quote
    return (Token){TOKEN_STRING, value, lexer->line, lexer->column - len - 2};
}

// Read an identifier or keyword
Token lexer_read_identifier(Lexer* lexer) {
    int start_pos = lexer->pos;
    while (isalnum(lexer->code[lexer->pos]) || lexer->code[lexer->pos] == '_') {
        lexer_advance_char(lexer);
    }
    int len = lexer->pos - start_pos;
    char* value = (char*)malloc(len + 1);
    strncpy(value, lexer->code + start_pos, len);
    value[len] = '\0';

    // Check if it's a keyword
    for (int i = 0; keywords[i].key != NULL; i++) {
        if (strcmp(value, keywords[i].key) == 0) {
            TokenType type = keywords[i].type;
            free(value); // Free the allocated string for keyword
            return (Token){type, (char*)keywords[i].key, lexer->line, lexer->column - len};
        }
    }
    return (Token){TOKEN_IDENTIFIER, value, lexer->line, lexer->column - len};
}

Token lexer_get_next_token(Lexer* lexer) {
    // Skip whitespace and comments
    while (lexer->pos < strlen(lexer->code)) {
        char c = lexer->code[lexer->pos];
        if (isspace(c) && c != '\n') { // Skip horizontal whitespace
            lexer_advance_char(lexer);
        } else if (c == '#') { // Skip comments
            while (lexer->pos < strlen(lexer->code) && lexer->code[lexer->pos] != '\n') {
                lexer_advance_char(lexer);
            }
        } else {
            break;
        }
    }

    if (lexer->pos >= strlen(lexer->code)) {
        return (Token){TOKEN_EOF, NULL, lexer->line, lexer->column};
    }

    char c = lexer->code[lexer->pos];
    Token token;

    if (isdigit(c)) {
        token = lexer_read_number(lexer);
    } else if (isalpha(c) || c == '_') {
        token = lexer_read_identifier(lexer);
    } else if (c == '"') {
        token = lexer_read_string(lexer);
    } else if (c == '\n') {
        lexer_advance_char(lexer);
        token = (Token){TOKEN_NEWLINE, "\n", lexer->line -1, 1}; // Newline was consumed
    } else {
        switch (c) {
            case '=': token = (Token){TOKEN_ASSIGN, "=", lexer->line, lexer->column}; break;
            case '+': token = (Token){TOKEN_PLUS, "+", lexer->line, lexer->column}; break;
            case '-': token = (Token){TOKEN_MINUS, "-", lexer->line, lexer->column}; break;
            case '*': token = (Token){TOKEN_TIMES, "*", lexer->line, lexer->column}; break;
            case '/': token = (Token){TOKEN_DIVIDE, "/", lexer->line, lexer->column}; break;
            case '(': token = (Token){TOKEN_LPAREN, "(", lexer->line, lexer->column}; break;
            case ')': token = (Token){TOKEN_RPAREN, ")", lexer->line, lexer->column}; break;
            case ',': token = (Token){TOKEN_COMMA, ",", lexer->line, lexer->column}; break;
            case ':': token = (Token){TOKEN_COLON, ":", lexer->line, lexer->column}; break;
            default:
                // Handle unknown characters gracefully by skipping them
                fprintf(stderr, "Lexer Warning: Unknown character '%c' at line %d, column %d. Skipping.\n", c, lexer->line, lexer->column);
                token = (Token){TOKEN_UNKNOWN, (char*)&c, lexer->line, lexer->column}; // Create token for warning, then skip
                break;
        }
        if (token.type != TOKEN_UNKNOWN) { // Only advance for recognized tokens
            lexer_advance_char(lexer);
        } else {
            // If it's unknown, advance one char to avoid infinite loop
            lexer_advance_char(lexer);
            return lexer_get_next_token(lexer); // Try to get next valid token
        }
    }
    return token;
}


// --- Parser ---
typedef struct {
    Lexer* lexer;
    Token current_token;
    Token peek_token; // For 1-token lookahead
} Parser;

void parser_init(Parser* parser, Lexer* lexer) {
    parser->lexer = lexer;
    // Prime the parser with two tokens for lookahead
    parser->current_token = lexer_get_next_token(parser->lexer);
    parser->peek_token = lexer_get_next_token(parser->lexer);
}

// Consumes current_token and fetches next_token
void parser_advance(Parser* parser) {
    // If the current token's value was dynamically allocated (e.g., IDENTIFIER, NUMBER, STRING), free it.
    // Keywords values point to static strings, no need to free.
    if (parser->current_token.value && 
        (parser->current_token.type == TOKEN_IDENTIFIER ||
         parser->current_token.type == TOKEN_NUMBER ||
         parser->current_token.type == TOKEN_STRING)
       ) {
        free(parser->current_token.value);
    }

    parser->current_token = parser->peek_token;
    parser->peek_token = lexer_get_next_token(parser->lexer);
}

// Checks if current token matches expected type(s) and advances
void parser_expect(Parser* parser, TokenType type) {
    if (parser->current_token.type == type) {
        parser_advance(parser);
    } else {
        fprintf(stderr, "Syntax Error: Expected token type %d, but got %d ('%s') at line %d, column %d.\n",
                type, parser->current_token.type, parser->current_token.value,
                parser->current_token.line, parser->current_token.column);
        exit(1);
    }
}

// Function to consume newlines
void parser_consume_newlines(Parser* parser) {
    while (parser->current_token.type == TOKEN_NEWLINE) {
        parser_advance(parser);
    }
}

// Forward declarations for recursive descent parsing
ASTNode* parse_expression(Parser* parser);
ASTNode* parse_term(Parser* parser);
ASTNode* parse_factor(Parser* parser);
ASTNode* parse_statement(Parser* parser);

// Main parsing function
ASTNode** parse_program(Parser* parser, int* num_statements) {
    ASTNode** statements = NULL;
    *num_statements = 0;
    int capacity = 2; // Initial capacity

    statements = (ASTNode**)malloc(sizeof(ASTNode*) * capacity);
    if (!statements) { fprintf(stderr, "Memory allocation failed for statements.\n"); exit(1); }

    parser_consume_newlines(parser); // Consume leading newlines

    while (parser->current_token.type != TOKEN_EOF) {
        if (*num_statements >= capacity) {
            capacity *= 2;
            statements = (ASTNode**)realloc(statements, sizeof(ASTNode*) * capacity);
            if (!statements) { fprintf(stderr, "Memory reallocation failed for statements.\n"); exit(1); }
        }
        
        ASTNode* stmt = parse_statement(parser);
        if (stmt) { // Only add if a statement was successfully parsed
            statements[(*num_statements)++] = stmt;
        }
        parser_consume_newlines(parser); // Consume newlines after each statement
    }
    return statements;
}

ASTNode* parse_statement(Parser* parser) {
    ASTNode* node = NULL;
    if (parser->current_token.type == TOKEN_PRINT) {
        parser_advance(parser); // Consume darshaya
        parser_expect(parser, TOKEN_LPAREN);
        ASTNode* expr = parse_expression(parser);
        parser_expect(parser, TOKEN_RPAREN);
        node = create_print_node(expr);
    } else if (parser->current_token.type == TOKEN_IDENTIFIER && parser->peek_token.type == TOKEN_ASSIGN) {
        char* var_name = parser->current_token.value; // Store value before advance
        parser_advance(parser); // Consume identifier
        parser_advance(parser); // Consume '='
        ASTNode* expr = parse_expression(parser);
        node = create_assign_node(var_name, expr);
    } else if (parser->current_token.type == TOKEN_NEWLINE) {
        parser_advance(parser); // Consume newline, try parsing next statement
        return NULL; // Indicate no actual statement was parsed, just a newline
    } else {
        fprintf(stderr, "Syntax Error: Unexpected token for statement '%s' at line %d, column %d.\n",
                parser->current_token.value, parser->current_token.line, parser->current_token.column);
        exit(1);
    }
    return node;
}


// Expression parsing (precedence climbing)
ASTNode* parse_expression(Parser* parser) {
    ASTNode* left = parse_term(parser);

    while (parser->current_token.type == TOKEN_PLUS || parser->current_token.type == TOKEN_MINUS) {
        TokenType op = parser->current_token.type;
        parser_advance(parser);
        ASTNode* right = parse_term(parser);
        left = create_binop_node(left, op, right);
    }
    return left;
}

ASTNode* parse_term(Parser* parser) {
    ASTNode* left = parse_factor(parser);

    while (parser->current_token.type == TOKEN_TIMES || parser->current_token.type == TOKEN_DIVIDE) {
        TokenType op = parser->current_token.type;
        parser_advance(parser);
        ASTNode* right = parse_factor(parser);
        left = create_binop_node(left, op, right);
    }
    return left;
}

ASTNode* parse_factor(Parser* parser) {
    ASTNode* node = NULL;
    if (parser->current_token.type == TOKEN_NUMBER) {
        node = create_number_node(atoi(parser->current_token.value));
        parser_advance(parser);
    } else if (parser->current_token.type == TOKEN_STRING) {
        node = create_string_node(parser->current_token.value);
        parser_advance(parser);
    } else if (parser->current_token.type == TOKEN_IDENTIFIER) {
        node = create_var_node(parser->current_token.value);
        parser_advance(parser);
    } else if (parser->current_token.type == TOKEN_LPAREN) {
        parser_advance(parser); // Consume '('
        node = parse_expression(parser);
        parser_expect(parser, TOKEN_RPAREN); // Consume ')'
    } else {
        fprintf(stderr, "Syntax Error: Unexpected token '%s' for factor at line %d, column %d.\n",
                parser->current_token.value, parser->current_token.line, parser->current_token.column);
        exit(1);
    }
    return node;
}

// --- Interpreter ---
// Simple symbol table using a linked list (for dynamic memory)
typedef struct Symbol {
    char* name;
    int value; // Only supports integer values for now
    struct Symbol* next;
} Symbol;

Symbol* symbol_table = NULL; // Global symbol table

// Set variable value
void set_symbol(const char* name, int value) {
    Symbol* current = symbol_table;
    while (current) {
        if (strcmp(current->name, name) == 0) {
            current->value = value;
            return;
        }
        current = current->next;
    }
    // If not found, create new symbol
    Symbol* new_symbol = (Symbol*)malloc(sizeof(Symbol));
    if (!new_symbol) { fprintf(stderr, "Memory allocation failed for symbol.\n"); exit(1); }
    new_symbol->name = (char*)malloc(strlen(name) + 1);
    strcpy(new_symbol->name, name);
    new_symbol->value = value;
    new_symbol->next = symbol_table;
    symbol_table = new_symbol;
}

// Get variable value
int get_symbol(const char* name) {
    Symbol* current = symbol_table;
    while (current) {
        if (strcmp(current->name, name) == 0) {
            return current->value;
        }
        current = current->next;
    }
    fprintf(stderr, "Name Error: Variable '%s' not found.\n", name);
    exit(1);
}

// Free symbol table
void free_symbol_table() {
    Symbol* current = symbol_table;
    while (current) {
        Symbol* next = current->next;
        free(current->name);
        free(current);
        current = next;
    }
    symbol_table = NULL;
}


// Evaluate expressions
int evaluate_expression(ASTNode* node) {
    if (!node) { fprintf(stderr, "Runtime Error: Null expression node.\n"); exit(1); }
    switch (node->type) {
        case NODE_NUMBER:
            return node->data.number_val;
        case NODE_STRING:
            fprintf(stderr, "Runtime Error: String '%s' cannot be evaluated as an integer expression.\n", node->data.string_val);
            exit(1);
        case NODE_VAR:
            return get_symbol(node->data.var_name);
        case NODE_BINOP: {
            int left_val = evaluate_expression(node->data.bin_op.left);
            int right_val = evaluate_expression(node->data.bin_op.right);
            switch (node->data.bin_op.op) {
                case TOKEN_PLUS: return left_val + right_val;
                case TOKEN_MINUS: return left_val - right_val;
                case TOKEN_TIMES: return left_val * right_val;
                case TOKEN_DIVIDE:
                    if (right_val == 0) {
                        fprintf(stderr, "Runtime Error: Division by zero.\n");
                        exit(1);
                    }
                    return left_val / right_val;
                default:
                    fprintf(stderr, "Runtime Error: Unknown binary operator.\n");
                    exit(1);
            }
        }
        default:
            fprintf(stderr, "Runtime Error: Unexpected node type in expression evaluation.\n");
            exit(1);
    }
}

// Execute statements
void execute_statement(ASTNode* node) {
    if (!node) return;
    switch (node->type) {
        case NODE_ASSIGN:
            set_symbol(node->data.assign_op.var_name, evaluate_expression(node->data.assign_op.expr));
            break;
        case NODE_PRINT: {
            ASTNode* expr = node->data.print_stmt.expr;
            if (expr->type == NODE_STRING) {
                printf("%s\n", expr->data.string_val);
            } else {
                printf("%d\n", evaluate_expression(expr));
            }
            break;
        }
        default:
            fprintf(stderr, "Runtime Error: Unexpected statement type.\n");
            exit(1);
    }
}

// --- Main execution flow ---
void run_panlang_code(const char* code) {
    Lexer lexer;
    parser_init(&lexer, code); // Initialize lexer, then parser (lexer is embedded)
    
    Parser parser;
    parser_init(&parser, &lexer);

    int num_statements = 0;
    ASTNode** program_ast = parse_program(&parser, &num_statements);

    printf("\n--- Abstract Syntax Tree (Parsed) ---\n");
    // In a real project, you'd print a structured AST for debugging.
    // For this simple mock, just confirm nodes exist.
    printf("Successfully parsed %d statements.\n", num_statements);

    printf("\n--- Execution Results ---\n");
    for (int i = 0; i < num_statements; i++) {
        execute_statement(program_ast[i]);
    }

    // Clean up
    for (int i = 0; i < num_statements; i++) {
        free_ast_node(program_ast[i]);
    }
    free(program_ast);
    free_symbol_table();
    
    // Free the remaining tokens from lexer
    // This is simplified; a more robust lexer/parser would manage token lifetimes explicitly
    // For now, only string/identifier/number tokens are dynamically allocated and freed in advance()
}

// --- REPL ---
void repl() {
    printf("PanLang REPL. Type 'nirgam' to exit.\n");
    char line[1024]; // Max line length
    while (1) {
        printf(">>> ");
        if (fgets(line, sizeof(line), stdin) == NULL) {
            printf("\nExiting REPL.\n");
            break;
        }
        if (strcmp(line, "nirgam\n") == 0) {
            printf("Exiting PanLang REPL.\n");
            break;
        }
        run_panlang_code(line);
        // Clear symbol table for each REPL line for simplicity.
        // A real REPL would maintain state.
        free_symbol_table(); 
    }
}


int main(int argc, char *argv[]) {
    if (argc == 2) {
        const char *file_path = argv[1];
        if (strlen(file_path) < 4 || strcmp(file_path + strlen(file_path) - 4, ".pan") != 0) {
            fprintf(stderr, "Error: PanLang files must have a .pan extension.\n");
            return 1;
        }

        FILE *f = fopen(file_path, "r");
        if (f == NULL) {
            perror("Error opening file");
            return 1;
        }

        // Read file content into a buffer
        fseek(f, 0, SEEK_END);
        long fsize = ftell(f);
        fseek(f, 0, SEEK_SET);
        char *code = (char*)malloc(fsize + 1);
        if (!code) { fprintf(stderr, "Memory allocation failed for file content.\n"); fclose(f); return 1; }
        fread(code, 1, fsize, f);
        code[fsize] = '\0';
        fclose(f);

        printf("--- PanLang Execution from %s ---\n", file_path);
        printf("Input Code:\n%s\n", code);

        run_panlang_code(code);
        free(code); // Free the file content buffer
    } else {
        repl();
    }
    return 0;
}

