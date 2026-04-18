import type { CompletionPlugin, CompletionContext, CompletionItem } from './completionTypes.js';

// ── NoesisGUI / WPF control elements ───────────────────────────────

const NOESIS_ELEMENTS: CompletionItem[] = [
  // Layout
  { label: 'Grid', insertText: '<Grid>\n\t$0\n</Grid>', detail: 'Layout panel', kind: 'snippet' },
  { label: 'StackPanel', insertText: '<StackPanel>\n\t$0\n</StackPanel>', detail: 'Layout panel', kind: 'snippet' },
  { label: 'DockPanel', insertText: '<DockPanel>\n\t$0\n</DockPanel>', detail: 'Layout panel', kind: 'snippet' },
  { label: 'WrapPanel', insertText: '<WrapPanel>\n\t$0\n</WrapPanel>', detail: 'Layout panel', kind: 'snippet' },
  { label: 'Canvas', insertText: '<Canvas>\n\t$0\n</Canvas>', detail: 'Layout panel', kind: 'snippet' },
  { label: 'UniformGrid', insertText: '<UniformGrid>\n\t$0\n</UniformGrid>', detail: 'Layout panel', kind: 'snippet' },
  { label: 'Border', insertText: '<Border>\n\t$0\n</Border>', detail: 'Decorator', kind: 'snippet' },
  { label: 'Viewbox', insertText: '<Viewbox>\n\t$0\n</Viewbox>', detail: 'Decorator', kind: 'snippet' },
  { label: 'ScrollViewer', insertText: '<ScrollViewer>\n\t$0\n</ScrollViewer>', detail: 'Layout panel', kind: 'snippet' },

  // Controls
  { label: 'Button', insertText: '<Button Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'TextBlock', insertText: '<TextBlock Text="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'TextBox', insertText: '<TextBox Text="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'Image', insertText: '<Image Source="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'CheckBox', insertText: '<CheckBox Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'RadioButton', insertText: '<RadioButton Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ComboBox', insertText: '<ComboBox>\n\t$0\n</ComboBox>', detail: 'Control', kind: 'snippet' },
  { label: 'ComboBoxItem', insertText: '<ComboBoxItem Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ListBox', insertText: '<ListBox>\n\t$0\n</ListBox>', detail: 'Control', kind: 'snippet' },
  { label: 'ListBoxItem', insertText: '<ListBoxItem Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'Slider', insertText: '<Slider Minimum="0" Maximum="100" Value="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ProgressBar', insertText: '<ProgressBar Minimum="0" Maximum="100" Value="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'Label', insertText: '<Label Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ToggleButton', insertText: '<ToggleButton Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'Expander', insertText: '<Expander Header="$0">\n\t\n</Expander>', detail: 'Control', kind: 'snippet' },
  { label: 'TabControl', insertText: '<TabControl>\n\t<TabItem Header="$0">\n\t\t\n\t</TabItem>\n</TabControl>', detail: 'Control', kind: 'snippet' },
  { label: 'TabItem', insertText: '<TabItem Header="$0">\n\t\n</TabItem>', detail: 'Control', kind: 'snippet' },
  { label: 'GroupBox', insertText: '<GroupBox Header="$0">\n\t\n</GroupBox>', detail: 'Control', kind: 'snippet' },
  { label: 'ToolTip', insertText: '<ToolTip Content="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ContentControl', insertText: '<ContentControl>\n\t$0\n</ContentControl>', detail: 'Control', kind: 'snippet' },
  { label: 'ContentPresenter', insertText: '<ContentPresenter />', detail: 'Control', kind: 'keyword' },
  { label: 'ItemsPresenter', insertText: '<ItemsPresenter />', detail: 'Control', kind: 'keyword' },
  { label: 'UserControl', insertText: '<UserControl>\n\t$0\n</UserControl>', detail: 'Control', kind: 'snippet' },
  { label: 'PasswordBox', insertText: '<PasswordBox />', detail: 'Control', kind: 'keyword' },
  { label: 'RichTextBox', insertText: '<RichTextBox />', detail: 'Control', kind: 'keyword' },
  { label: 'Menu', insertText: '<Menu>\n\t$0\n</Menu>', detail: 'Control', kind: 'snippet' },
  { label: 'MenuItem', insertText: '<MenuItem Header="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ContextMenu', insertText: '<ContextMenu>\n\t$0\n</ContextMenu>', detail: 'Control', kind: 'snippet' },
  { label: 'ToolBar', insertText: '<ToolBar>\n\t$0\n</ToolBar>', detail: 'Control', kind: 'snippet' },
  { label: 'StatusBar', insertText: '<StatusBar>\n\t$0\n</StatusBar>', detail: 'Control', kind: 'snippet' },
  { label: 'TreeView', insertText: '<TreeView>\n\t$0\n</TreeView>', detail: 'Control', kind: 'snippet' },
  { label: 'TreeViewItem', insertText: '<TreeViewItem Header="$0" />', detail: 'Control', kind: 'snippet' },
  { label: 'ListView', insertText: '<ListView>\n\t$0\n</ListView>', detail: 'Control', kind: 'snippet' },

  // Shapes
  { label: 'Rectangle', insertText: '<Rectangle Width="$0" Height="" />', detail: 'Shape', kind: 'snippet' },
  { label: 'Ellipse', insertText: '<Ellipse Width="$0" Height="" />', detail: 'Shape', kind: 'snippet' },
  { label: 'Line', insertText: '<Line X1="0" Y1="0" X2="$0" Y2="" />', detail: 'Shape', kind: 'snippet' },
  { label: 'Path', insertText: '<Path Data="$0" />', detail: 'Shape', kind: 'snippet' },
  { label: 'Polygon', insertText: '<Polygon Points="$0" />', detail: 'Shape', kind: 'snippet' },
  { label: 'Polyline', insertText: '<Polyline Points="$0" />', detail: 'Shape', kind: 'snippet' },

  // Resources & Styles
  { label: 'Style', insertText: '<Style TargetType="{x:Type $0}">\n\t\n</Style>', detail: 'Style', kind: 'snippet' },
  { label: 'Setter', insertText: '<Setter Property="$0" Value="" />', detail: 'Style setter', kind: 'snippet' },
  { label: 'ControlTemplate', insertText: '<ControlTemplate TargetType="{x:Type $0}">\n\t\n</ControlTemplate>', detail: 'Template', kind: 'snippet' },
  { label: 'DataTemplate', insertText: '<DataTemplate>\n\t$0\n</DataTemplate>', detail: 'Template', kind: 'snippet' },
  { label: 'ItemsPanelTemplate', insertText: '<ItemsPanelTemplate>\n\t$0\n</ItemsPanelTemplate>', detail: 'Template', kind: 'snippet' },
  { label: 'ResourceDictionary', insertText: '<ResourceDictionary>\n\t$0\n</ResourceDictionary>', detail: 'Resources', kind: 'snippet' },

  // Transforms
  { label: 'RotateTransform', insertText: '<RotateTransform Angle="$0" />', detail: 'Transform', kind: 'snippet' },
  { label: 'ScaleTransform', insertText: '<ScaleTransform ScaleX="$0" ScaleY="" />', detail: 'Transform', kind: 'snippet' },
  { label: 'TranslateTransform', insertText: '<TranslateTransform X="$0" Y="" />', detail: 'Transform', kind: 'snippet' },
  { label: 'TransformGroup', insertText: '<TransformGroup>\n\t$0\n</TransformGroup>', detail: 'Transform', kind: 'snippet' },

  // Animation
  { label: 'Storyboard', insertText: '<Storyboard>\n\t$0\n</Storyboard>', detail: 'Animation', kind: 'snippet' },
  { label: 'DoubleAnimation', insertText: '<DoubleAnimation Storyboard.TargetProperty="$0" From="" To="" Duration="0:0:0.3" />', detail: 'Animation', kind: 'snippet' },
  { label: 'ColorAnimation', insertText: '<ColorAnimation Storyboard.TargetProperty="$0" To="" Duration="0:0:0.3" />', detail: 'Animation', kind: 'snippet' },

  // Triggers
  { label: 'DataTrigger', insertText: '<DataTrigger Binding="{Binding $0}" Value="">\n\t\n</DataTrigger>', detail: 'Trigger', kind: 'snippet' },
  { label: 'Trigger', insertText: '<Trigger Property="$0" Value="">\n\t\n</Trigger>', detail: 'Trigger', kind: 'snippet' },
  { label: 'EventTrigger', insertText: '<EventTrigger RoutedEvent="$0">\n\t\n</EventTrigger>', detail: 'Trigger', kind: 'snippet' },
  { label: 'MultiDataTrigger', insertText: '<MultiDataTrigger>\n\t<MultiDataTrigger.Conditions>\n\t\t$0\n\t</MultiDataTrigger.Conditions>\n</MultiDataTrigger>', detail: 'Trigger', kind: 'snippet' },

  // Brushes
  { label: 'SolidColorBrush', insertText: '<SolidColorBrush Color="$0" />', detail: 'Brush', kind: 'snippet' },
  { label: 'LinearGradientBrush', insertText: '<LinearGradientBrush StartPoint="0,0" EndPoint="1,1">\n\t<GradientStop Color="$0" Offset="0" />\n\t<GradientStop Color="" Offset="1" />\n</LinearGradientBrush>', detail: 'Brush', kind: 'snippet' },
  { label: 'RadialGradientBrush', insertText: '<RadialGradientBrush>\n\t<GradientStop Color="$0" Offset="0" />\n\t<GradientStop Color="" Offset="1" />\n</RadialGradientBrush>', detail: 'Brush', kind: 'snippet' },
  { label: 'GradientStop', insertText: '<GradientStop Color="$0" Offset="" />', detail: 'Brush', kind: 'snippet' },
  { label: 'ImageBrush', insertText: '<ImageBrush ImageSource="$0" />', detail: 'Brush', kind: 'snippet' },

  // Grid specifics
  { label: 'ColumnDefinition', insertText: '<ColumnDefinition Width="$0" />', detail: 'Grid', kind: 'snippet' },
  { label: 'RowDefinition', insertText: '<RowDefinition Height="$0" />', detail: 'Grid', kind: 'snippet' },
];

// ── Common attributes (suggested inside opening tags) ───────────────

const COMMON_ATTRIBUTES: CompletionItem[] = [
  // Layout
  { label: 'Width', insertText: 'Width="$0"', detail: 'Layout', kind: 'property' },
  { label: 'Height', insertText: 'Height="$0"', detail: 'Layout', kind: 'property' },
  { label: 'MinWidth', insertText: 'MinWidth="$0"', detail: 'Layout', kind: 'property' },
  { label: 'MinHeight', insertText: 'MinHeight="$0"', detail: 'Layout', kind: 'property' },
  { label: 'MaxWidth', insertText: 'MaxWidth="$0"', detail: 'Layout', kind: 'property' },
  { label: 'MaxHeight', insertText: 'MaxHeight="$0"', detail: 'Layout', kind: 'property' },
  { label: 'Margin', insertText: 'Margin="$0"', detail: 'Layout (T,R,B,L or uniform)', kind: 'property' },
  { label: 'Padding', insertText: 'Padding="$0"', detail: 'Layout', kind: 'property' },
  { label: 'HorizontalAlignment', insertText: 'HorizontalAlignment="$0"', detail: 'Left|Center|Right|Stretch', kind: 'property' },
  { label: 'VerticalAlignment', insertText: 'VerticalAlignment="$0"', detail: 'Top|Center|Bottom|Stretch', kind: 'property' },
  { label: 'HorizontalContentAlignment', insertText: 'HorizontalContentAlignment="$0"', detail: 'Content alignment', kind: 'property' },
  { label: 'VerticalContentAlignment', insertText: 'VerticalContentAlignment="$0"', detail: 'Content alignment', kind: 'property' },

  // Grid attached
  { label: 'Grid.Row', insertText: 'Grid.Row="$0"', detail: 'Grid attached', kind: 'property' },
  { label: 'Grid.Column', insertText: 'Grid.Column="$0"', detail: 'Grid attached', kind: 'property' },
  { label: 'Grid.RowSpan', insertText: 'Grid.RowSpan="$0"', detail: 'Grid attached', kind: 'property' },
  { label: 'Grid.ColumnSpan', insertText: 'Grid.ColumnSpan="$0"', detail: 'Grid attached', kind: 'property' },

  // DockPanel attached
  { label: 'DockPanel.Dock', insertText: 'DockPanel.Dock="$0"', detail: 'Left|Top|Right|Bottom', kind: 'property' },

  // Canvas attached
  { label: 'Canvas.Left', insertText: 'Canvas.Left="$0"', detail: 'Canvas attached', kind: 'property' },
  { label: 'Canvas.Top', insertText: 'Canvas.Top="$0"', detail: 'Canvas attached', kind: 'property' },

  // Appearance
  { label: 'Background', insertText: 'Background="$0"', detail: 'Brush', kind: 'property' },
  { label: 'Foreground', insertText: 'Foreground="$0"', detail: 'Brush', kind: 'property' },
  { label: 'BorderBrush', insertText: 'BorderBrush="$0"', detail: 'Brush', kind: 'property' },
  { label: 'BorderThickness', insertText: 'BorderThickness="$0"', detail: 'Thickness', kind: 'property' },
  { label: 'CornerRadius', insertText: 'CornerRadius="$0"', detail: 'Radius', kind: 'property' },
  { label: 'Opacity', insertText: 'Opacity="$0"', detail: '0.0 - 1.0', kind: 'property' },
  { label: 'Visibility', insertText: 'Visibility="$0"', detail: 'Visible|Hidden|Collapsed', kind: 'property' },
  { label: 'IsEnabled', insertText: 'IsEnabled="$0"', detail: 'True|False', kind: 'property' },
  { label: 'IsHitTestVisible', insertText: 'IsHitTestVisible="$0"', detail: 'True|False', kind: 'property' },
  { label: 'ClipToBounds', insertText: 'ClipToBounds="$0"', detail: 'True|False', kind: 'property' },
  { label: 'Focusable', insertText: 'Focusable="$0"', detail: 'True|False', kind: 'property' },

  // Text
  { label: 'FontSize', insertText: 'FontSize="$0"', detail: 'Font', kind: 'property' },
  { label: 'FontFamily', insertText: 'FontFamily="$0"', detail: 'Font', kind: 'property' },
  { label: 'FontWeight', insertText: 'FontWeight="$0"', detail: 'Normal|Bold|..', kind: 'property' },
  { label: 'FontStyle', insertText: 'FontStyle="$0"', detail: 'Normal|Italic|Oblique', kind: 'property' },
  { label: 'TextAlignment', insertText: 'TextAlignment="$0"', detail: 'Left|Center|Right', kind: 'property' },
  { label: 'TextWrapping', insertText: 'TextWrapping="$0"', detail: 'NoWrap|Wrap|WrapWithOverflow', kind: 'property' },
  { label: 'TextTrimming', insertText: 'TextTrimming="$0"', detail: 'None|CharacterEllipsis|WordEllipsis', kind: 'property' },

  // Content
  { label: 'Content', insertText: 'Content="$0"', detail: 'Content', kind: 'property' },
  { label: 'Text', insertText: 'Text="$0"', detail: 'Text', kind: 'property' },
  { label: 'Source', insertText: 'Source="$0"', detail: 'Image source', kind: 'property' },
  { label: 'Header', insertText: 'Header="$0"', detail: 'Header', kind: 'property' },
  { label: 'ToolTip', insertText: 'ToolTip="$0"', detail: 'Tooltip text', kind: 'property' },

  // Naming & binding
  { label: 'x:Name', insertText: 'x:Name="$0"', detail: 'Element name', kind: 'property' },
  { label: 'x:Key', insertText: 'x:Key="$0"', detail: 'Resource key', kind: 'property' },
  { label: 'x:Class', insertText: 'x:Class="$0"', detail: 'Code-behind class', kind: 'property' },
  { label: 'DataContext', insertText: 'DataContext="$0"', detail: 'Data context', kind: 'property' },
  { label: 'Style', insertText: 'Style="{StaticResource $0}"', detail: 'Style reference', kind: 'snippet' },
  { label: 'Command', insertText: 'Command="{Binding $0}"', detail: 'Command binding', kind: 'snippet' },
  { label: 'ItemsSource', insertText: 'ItemsSource="{Binding $0}"', detail: 'Items binding', kind: 'snippet' },

  // StackPanel
  { label: 'Orientation', insertText: 'Orientation="$0"', detail: 'Horizontal|Vertical', kind: 'property' },

  // Grid
  { label: 'RowDefinitions', insertText: 'RowDefinitions="$0"', detail: 'Grid rows', kind: 'property' },
  { label: 'ColumnDefinitions', insertText: 'ColumnDefinitions="$0"', detail: 'Grid columns', kind: 'property' },

  // Transform & effects
  { label: 'RenderTransform', insertText: 'RenderTransform="$0"', detail: 'Transform', kind: 'property' },
  { label: 'RenderTransformOrigin', insertText: 'RenderTransformOrigin="$0"', detail: 'Origin point 0,0-1,1', kind: 'property' },

  // Scroll
  { label: 'HorizontalScrollBarVisibility', insertText: 'HorizontalScrollBarVisibility="$0"', detail: 'Auto|Visible|Hidden|Disabled', kind: 'property' },
  { label: 'VerticalScrollBarVisibility', insertText: 'VerticalScrollBarVisibility="$0"', detail: 'Auto|Visible|Hidden|Disabled', kind: 'property' },

  // Stretch
  { label: 'Stretch', insertText: 'Stretch="$0"', detail: 'None|Fill|Uniform|UniformToFill', kind: 'property' },

  // Events
  { label: 'Click', insertText: 'Click="$0"', detail: 'Event handler', kind: 'property' },
  { label: 'Loaded', insertText: 'Loaded="$0"', detail: 'Event handler', kind: 'property' },
  { label: 'MouseEnter', insertText: 'MouseEnter="$0"', detail: 'Event handler', kind: 'property' },
  { label: 'MouseLeave', insertText: 'MouseLeave="$0"', detail: 'Event handler', kind: 'property' },

  // TargetType
  { label: 'TargetType', insertText: 'TargetType="{x:Type $0}"', detail: 'Style/template target', kind: 'snippet' },
  { label: 'Property', insertText: 'Property="$0"', detail: 'Property name', kind: 'property' },
  { label: 'Value', insertText: 'Value="$0"', detail: 'Property value', kind: 'property' },
];

// ── Markup extensions (inside attribute values) ─────────────────────

const MARKUP_EXTENSIONS: CompletionItem[] = [
  { label: '{Binding}', insertText: '{Binding $0}', detail: 'Data binding', kind: 'snippet' },
  { label: '{Binding Path=}', insertText: '{Binding Path=$0}', detail: 'Binding with path', kind: 'snippet' },
  { label: '{StaticResource}', insertText: '{StaticResource $0}', detail: 'Static resource ref', kind: 'snippet' },
  { label: '{DynamicResource}', insertText: '{DynamicResource $0}', detail: 'Dynamic resource ref', kind: 'snippet' },
  { label: '{x:Type}', insertText: '{x:Type $0}', detail: 'Type reference', kind: 'snippet' },
  { label: '{x:Static}', insertText: '{x:Static $0}', detail: 'Static member ref', kind: 'snippet' },
  { label: '{x:Null}', insertText: '{x:Null}', detail: 'Null value', kind: 'keyword' },
  { label: '{RelativeSource Self}', insertText: '{RelativeSource Self}', detail: 'RelativeSource', kind: 'snippet' },
  { label: '{RelativeSource TemplatedParent}', insertText: '{RelativeSource TemplatedParent}', detail: 'RelativeSource', kind: 'snippet' },
  { label: '{TemplateBinding}', insertText: '{TemplateBinding $0}', detail: 'Template binding', kind: 'snippet' },
];

// ── XML namespace declarations ──────────────────────────────────────

const NAMESPACE_DECLARATIONS: CompletionItem[] = [
  { label: 'xmlns', insertText: 'xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"', detail: 'Default WPF namespace', kind: 'property', sortOrder: 1 },
  { label: 'xmlns:x', insertText: 'xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"', detail: 'XAML namespace', kind: 'property', sortOrder: 2 },
  { label: 'xmlns:noesis', insertText: 'xmlns:noesis="clr-namespace:NoesisGUIExtensions;assembly=Noesis.GUI.Extensions"', detail: 'Noesis extensions', kind: 'property', sortOrder: 3 },
  { label: 'xmlns:b', insertText: 'xmlns:b="http://schemas.microsoft.com/xaml/behaviors"', detail: 'Behaviors namespace', kind: 'property', sortOrder: 4 },
  { label: 'xmlns:d', insertText: 'xmlns:d="http://schemas.microsoft.com/expression/blend/2008"', detail: 'Design-time namespace', kind: 'property', sortOrder: 5 },
  { label: 'xmlns:mc', insertText: 'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"', detail: 'Markup compatibility', kind: 'property', sortOrder: 6 },
];

// ── Context detection helpers ───────────────────────────────────────

/** Check if cursor is inside an opening tag (between < and the next >) */
function isInsideOpenTag(lineText: string): boolean {
  let depth = 0;
  for (let i = lineText.length - 1; i >= 0; i--) {
    if (lineText[i] === '>') depth++;
    if (lineText[i] === '<') {
      if (depth === 0) return true;
      depth--;
    }
  }
  return false;
}

/** Check if cursor is inside an attribute value (after = and opening quote) */
function isInsideAttrValue(lineText: string): boolean {
  const match = lineText.match(/=\s*"[^"]*$/);
  return !!match;
}

/** Extract the partial element or attribute name being typed */
function extractXamlPrefix(lineText: string): string {
  // Inside attribute value — match markup extension prefix
  if (isInsideAttrValue(lineText)) {
    const m = lineText.match(/\{(\w*\.?\w*)$/);
    return m ? m[0] : '';
  }
  // Inside an opening tag — match attribute name
  if (isInsideOpenTag(lineText)) {
    const m = lineText.match(/([\w.:]+)$/);
    return m ? m[1] : '';
  }
  // At element position — match < + element name
  const m = lineText.match(/<\/?(\w*)$/);
  return m ? m[1] : '';
}

// ── Plugin ──────────────────────────────────────────────────────────

export const noesisXamlPlugin: CompletionPlugin = {
  id: 'noesis-xaml',
  name: 'NoesisGUI XAML',
  languages: ['xaml'],
  priority: 50,

  getCompletions(ctx: CompletionContext): CompletionItem[] {
    const line = ctx.lineTextBeforeCursor;
    const prefix = extractXamlPrefix(line);

    // Inside attribute value — suggest markup extensions
    if (isInsideAttrValue(line)) {
      if (!prefix) return [];
      return MARKUP_EXTENSIONS.filter(it =>
        it.label.toLowerCase().startsWith(prefix.toLowerCase())
      );
    }

    // Inside an opening tag — suggest attributes
    if (isInsideOpenTag(line)) {
      if (!prefix) return [];
      const lp = prefix.toLowerCase();
      // Suggest xmlns at root-level tags
      const attrs = [...COMMON_ATTRIBUTES];
      if (lp.startsWith('xmlns')) {
        attrs.push(...NAMESPACE_DECLARATIONS);
      } else {
        // Still include xmlns if user is typing it
        attrs.push(...NAMESPACE_DECLARATIONS.filter(it => it.label.toLowerCase().startsWith(lp)));
      }
      return attrs.filter(it => it.label.toLowerCase().startsWith(lp));
    }

    // Element context — after < or at start of child
    if (prefix) {
      const lp = prefix.toLowerCase();
      return NOESIS_ELEMENTS.filter(it => it.label.toLowerCase().startsWith(lp));
    }

    return [];
  },
};
