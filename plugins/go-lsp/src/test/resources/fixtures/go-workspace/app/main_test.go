package main

import "testing"

func TestPass(t *testing.T) {}

func TestSkip(t *testing.T) {
	t.Skip("fixture skip")
}

func TestFail(t *testing.T) {
	t.Fatal("fixture failure")
}
