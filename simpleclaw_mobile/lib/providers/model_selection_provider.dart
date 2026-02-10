import 'package:flutter_riverpod/flutter_riverpod.dart';

class SelectionState {
  final String selectedModel;
  final String? selectedChannel;

  const SelectionState({
    this.selectedModel = 'claude-opus-4.5',
    this.selectedChannel,
  });

  SelectionState copyWith({
    String? selectedModel,
    String? Function()? selectedChannel,
  }) {
    return SelectionState(
      selectedModel: selectedModel ?? this.selectedModel,
      selectedChannel:
          selectedChannel != null ? selectedChannel() : this.selectedChannel,
    );
  }
}

class ModelSelectionNotifier extends StateNotifier<SelectionState> {
  ModelSelectionNotifier() : super(const SelectionState());

  void setModel(String model) {
    state = state.copyWith(selectedModel: model);
  }

  void setChannel(String? channel) {
    state = state.copyWith(selectedChannel: () => channel);
  }
}

final modelSelectionProvider =
    StateNotifierProvider<ModelSelectionNotifier, SelectionState>(
  (ref) => ModelSelectionNotifier(),
);
