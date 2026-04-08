---
uuid: "1e9a0588-14bc-4934-807f-24d96949de62"
type: knowledge
status: reviewed
created: "2026-04-07"
modified: "2026-04-07"
tags: [deep-learning, neural-networks, machine-learning, transformers]
related:
  - uuid: "a3a4f67f-d203-4319-a07d-8277c0b4f479"
    rel: "builds-on"
    auto: true
  - uuid: "dbf69c85-7a10-4a41-8a17-b7fc0cb649cc"
    rel: "applied-in"
    auto: true
summary: "Survey of modern deep learning architectures including CNNs, RNNs, and Transformers."
---

# Deep Learning Architectures

Deep learning has revolutionized artificial intelligence by enabling machines to learn hierarchical representations from raw data. This note surveys the major architectural families.

## Convolutional Neural Networks (CNNs)

CNNs are designed for processing grid-like data such as images. They use convolutional layers that apply learned filters across the input.

### Key Components
- **Convolutional layers**: Extract local features using learned kernels
- **Pooling layers**: Reduce spatial dimensions (max pooling, average pooling)
- **Fully connected layers**: Final classification/regression

### Notable Architectures
- LeNet-5 (1998): Pioneer architecture for digit recognition
- AlexNet (2012): Breakthrough on ImageNet
- VGGNet (2014): Demonstrated depth importance
- ResNet (2015): Introduced skip connections enabling very deep networks
- EfficientNet (2019): Compound scaling of depth, width, resolution

## Recurrent Neural Networks (RNNs)

RNNs process sequential data by maintaining hidden state across time steps.

### Variants
- **Vanilla RNN**: Simple but suffers from vanishing gradients
- **LSTM**: Long Short-Term Memory with gating mechanisms
- **GRU**: Gated Recurrent Unit, simplified LSTM variant

## Transformers

The Transformer architecture, introduced in "Attention Is All You Need" (2017), has become the dominant paradigm for NLP and increasingly for vision tasks.

### Self-Attention Mechanism

The core innovation is the self-attention mechanism, which computes attention weights between all pairs of positions in a sequence:

$$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$

### Notable Transformer Models
- **BERT**: Bidirectional encoder for understanding tasks
- **GPT series**: Autoregressive decoder for generation
- **T5**: Text-to-text framework
- **Vision Transformer (ViT)**: Applies transformers to image patches

## Generative Models

### Variational Autoencoders (VAEs)
Encode data into a latent distribution and decode to generate new samples.

### Generative Adversarial Networks (GANs)
Two networks (generator and discriminator) trained adversarially.

### Diffusion Models
Iteratively denoise random noise to generate high-quality samples. Have achieved state-of-the-art results in image generation.
