# Clone Spotter Go Implementation Makefile

# Variables
BINARY_NAME=clone-spotter
BUILD_DIR=build
VERSION=2.0.0
GO_VERSION=1.21

# Default target
.PHONY: all
all: build

# Build the binary
.PHONY: build
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) -ldflags "-X main.Version=$(VERSION)" .
	@echo "✅ Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

# Build for multiple platforms
.PHONY: build-all
build-all:
	@echo "Building for multiple platforms..."
	@mkdir -p $(BUILD_DIR)
	
	# Linux AMD64
	GOOS=linux GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 .
	
	# macOS AMD64
	GOOS=darwin GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 .
	
	# macOS ARM64 (Apple Silicon)
	GOOS=darwin GOARCH=arm64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-arm64 .
	
	# Windows AMD64
	GOOS=windows GOARCH=amd64 go build -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe .
	
	@echo "✅ Cross-platform builds complete"

# Install dependencies
.PHONY: deps
deps:
	@echo "Installing dependencies..."
	go mod download
	go mod tidy
	@echo "✅ Dependencies installed"

# Run tests
.PHONY: test
test:
	@echo "Running tests..."
	go test -v ./...
	@echo "✅ Tests complete"

# Run the application
.PHONY: run
run: build
	@echo "Running $(BINARY_NAME)..."
	./$(BUILD_DIR)/$(BINARY_NAME)

# Run with specific directory
.PHONY: run-dir
run-dir: build
	@echo "Running $(BINARY_NAME) on current directory..."
	./$(BUILD_DIR)/$(BINARY_NAME) .

# Run interactive mode
.PHONY: run-interactive
run-interactive: build
	@echo "Running $(BINARY_NAME) in interactive mode..."
	./$(BUILD_DIR)/$(BINARY_NAME) interactive

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(BUILD_DIR)
	go clean
	@echo "✅ Clean complete"

# Format code
.PHONY: fmt
fmt:
	@echo "Formatting code..."
	go fmt ./...
	@echo "✅ Code formatted"

# Lint code
.PHONY: lint
lint:
	@echo "Linting code..."
	golangci-lint run
	@echo "✅ Linting complete"

# Install the binary to GOPATH/bin
.PHONY: install
install: build
	@echo "Installing $(BINARY_NAME)..."
	go install .
	@echo "✅ Installed to $(GOPATH)/bin/$(BINARY_NAME)"

# Show help
.PHONY: help
help:
	@echo "Clone Spotter Go Implementation"
	@echo "==============================="
	@echo ""
	@echo "Available targets:"
	@echo "  build          - Build the binary"
	@echo "  build-all      - Build for multiple platforms"
	@echo "  deps           - Install dependencies"
	@echo "  test           - Run tests"
	@echo "  run            - Run the application"
	@echo "  run-dir        - Run on current directory"
	@echo "  run-interactive- Run in interactive mode"
	@echo "  clean          - Clean build artifacts"
	@echo "  fmt            - Format code"
	@echo "  lint           - Lint code"
	@echo "  install        - Install to GOPATH/bin"
	@echo "  help           - Show this help"
	@echo ""
	@echo "Examples:"
	@echo "  make build                    # Build the binary"
	@echo "  make run-dir                  # Run on current directory"
	@echo "  make run-interactive          # Run in interactive mode"
	@echo "  make build-all                # Build for all platforms"
