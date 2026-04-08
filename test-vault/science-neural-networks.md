---
uuid: "df395a01-12c0-4758-a924-26c8b2d6e486"
type: knowledge
status: reviewed
created: "2026-04-07"
modified: "2026-04-08"
tags: [science, ai, machine-learning, neural-networks]
related: []
summary: "Introduction to artificial neural networks covering architecture, activation functions, and backpropagation."
---

# Artificial Neural Networks

Artificial neural networks (ANNs) are computational models inspired by the biological neural networks in the human brain. They form the foundation of modern deep learning and have driven breakthroughs in image recognition, natural language processing, and autonomous systems.

## Architecture

A neural network consists of layers of interconnected nodes (neurons):

### Input Layer
Receives raw data. Each node represents one feature of the input (e.g., a pixel value, a word embedding, a sensor reading). The input layer performs no computation; it simply passes data to the next layer.

### Hidden Layers
Where computation happens. Each neuron computes a **weighted sum** of its inputs, adds a **bias term**, and passes the result through an **activation function**:

```
output = activation(w1*x1 + w2*x2 + ... + wn*xn + bias)
```

Deep networks have multiple hidden layers, enabling them to learn hierarchical representations. Early layers detect simple patterns (edges, phonemes), while deeper layers compose these into complex features (faces, sentences).

### Output Layer
Produces the final prediction. Its structure depends on the task:
- **Classification**: One node per class, with softmax activation
- **Regression**: Single node with linear activation
- **Generation**: Variable structure depending on the output domain

## Activation Functions

Activation functions introduce **non-linearity**, allowing networks to learn complex patterns:

| Function | Formula | Range | Use Case |
|----------|---------|-------|----------|
| ReLU | max(0, x) | [0, inf) | Default for hidden layers |
| Sigmoid | 1/(1+e^-x) | (0, 1) | Binary classification output |
| Tanh | (e^x - e^-x)/(e^x + e^-x) | (-1, 1) | Normalized hidden layers |
| Softmax | e^xi / sum(e^xj) | (0, 1) | Multi-class output |
| Leaky ReLU | max(0.01x, x) | (-inf, inf) | Addresses dying ReLU |

The choice of activation function significantly impacts training dynamics. ReLU and its variants have largely replaced sigmoid and tanh in hidden layers due to faster training and reduced vanishing gradient problems.

## Backpropagation

Backpropagation is the algorithm that enables neural networks to **learn from errors**:

1. **Forward pass**: Input data flows through the network, producing a prediction
2. **Loss calculation**: The prediction is compared to the true label using a loss function (e.g., cross-entropy, mean squared error)
3. **Backward pass**: The gradient of the loss with respect to each weight is computed using the chain rule of calculus
4. **Weight update**: Weights are adjusted in the direction that reduces the loss, scaled by a learning rate

The process repeats over many iterations (epochs) until the network converges. Key challenges include:

- **Vanishing gradients**: Gradients become too small in deep networks, slowing learning
- **Exploding gradients**: Gradients become too large, causing instability
- **Overfitting**: The network memorizes training data rather than learning generalizable patterns

## Modern Developments

Recent advances in #deep-learning include transformer architectures (the basis for large language models), graph neural networks, and neural architecture search. The field continues to evolve rapidly, with ongoing research into interpretability, efficiency, and the theoretical foundations of why deep learning works as well as it does.
