---
uuid: "a3a4f67f-d203-4319-a07d-8277c0b4f479"
type: knowledge
status: reviewed
created: "2026-04-07"
modified: "2026-04-07"
tags: [machine-learning, algorithms, data-science, neural-networks]
related:
  - uuid: "1e9a0588-14bc-4934-807f-24d96949de62"
    rel: "extends"
    auto: true
  - uuid: "fa051917-439e-47b1-b0fc-9a1f88587cc6"
    rel: "references"
    auto: false
summary: "Overview of fundamental machine learning concepts including supervised and unsupervised learning."
---

# Machine Learning Basics

Machine learning is a subset of artificial intelligence that focuses on building systems that learn from data. Rather than being explicitly programmed, these systems improve their performance on a specific task through experience.

## Supervised Learning

In supervised learning, the algorithm learns from labeled training data. The goal is to learn a mapping function from input variables to output variables. Common algorithms include:

- **Linear Regression**: Predicts continuous values
- **Logistic Regression**: Predicts binary outcomes
- **Decision Trees**: Creates tree-like models of decisions
- **Random Forests**: Ensemble of decision trees
- **Support Vector Machines**: Finds optimal hyperplanes for classification

## Unsupervised Learning

Unsupervised learning works with unlabeled data to find hidden patterns or intrinsic structures. Key techniques include:

- **K-Means Clustering**: Partitions data into k clusters
- **Hierarchical Clustering**: Builds nested cluster hierarchies
- **Principal Component Analysis**: Dimensionality reduction
- **Autoencoders**: Neural network-based dimensionality reduction

## Neural Networks

Neural networks are computing systems inspired by biological neural networks. They consist of layers of interconnected nodes (neurons) that process information. Deep learning uses neural networks with many hidden layers to learn complex representations.

### Activation Functions

Common activation functions include ReLU, sigmoid, tanh, and softmax. The choice of activation function affects the network's ability to learn non-linear relationships.

### Backpropagation

Backpropagation is the primary algorithm for training neural networks. It computes gradients of the loss function with respect to each weight by applying the chain rule of calculus.

## Model Evaluation

Key metrics for evaluating ML models:

- **Accuracy**: Overall correctness
- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1 Score**: Harmonic mean of precision and recall
- **AUC-ROC**: Area under the receiver operating characteristic curve

## Bias-Variance Tradeoff

The bias-variance tradeoff is a fundamental concept. High bias leads to underfitting, while high variance leads to overfitting. The goal is to find the sweet spot that minimizes total error.
