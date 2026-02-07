import type {
  CodebaseGraph,
  GuardianKernel,
  GuardianPlugin,
  Rule,
} from './types.js';
import { PluginError } from './errors.js';

/**
 * Create the micro kernel that manages plugins and rules.
 *
 * @returns Kernel instance with plugin/rule management
 *
 * @example
 * ```typescript
 * const kernel = createKernel();
 * kernel.installPlugin(myPlugin);
 * const rules = kernel.getRules();
 * ```
 */
export function createKernel() {
  const plugins = new Map<string, GuardianPlugin>();
  const rules = new Map<string, Rule>();

  /**
   * Create a GuardianKernel adapter for a specific plugin.
   */
  function createKernelAdapter<TConfig>(config: TConfig): GuardianKernel<TConfig> {
    return {
      registerRule(rule: Rule): void {
        if (rules.has(rule.name)) {
          throw new PluginError(`Rule "${rule.name}" is already registered`, {
            rule: rule.name,
          });
        }
        rules.set(rule.name, rule);
      },

      unregisterRule(name: string): void {
        rules.delete(name);
      },

      getRules(): Rule[] {
        return Array.from(rules.values());
      },

      getConfig(): TConfig {
        return config;
      },
    };
  }

  return {
    /**
     * Install a plugin into the kernel.
     *
     * @example
     * ```typescript
     * kernel.installPlugin(architecturePlugin({ layers: [...] }));
     * ```
     */
    installPlugin<TConfig>(plugin: GuardianPlugin<TConfig>, config?: TConfig): void {
      if (plugins.has(plugin.name)) {
        throw new PluginError(`Plugin "${plugin.name}" is already installed`, {
          plugin: plugin.name,
        });
      }

      // Check dependencies
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!plugins.has(dep)) {
            throw new PluginError(
              `Plugin "${plugin.name}" depends on "${dep}" which is not installed`,
              { plugin: plugin.name, dependency: dep },
            );
          }
        }
      }

      const adapter = createKernelAdapter(config ?? ({} as TConfig));

      try {
        plugin.install(adapter);
        plugins.set(plugin.name, plugin as GuardianPlugin);
      } catch (err) {
        if (plugin.onError && err instanceof Error) {
          plugin.onError(err);
        }
        throw new PluginError(
          `Failed to install plugin "${plugin.name}": ${err instanceof Error ? err.message : String(err)}`,
          { plugin: plugin.name },
        );
      }
    },

    /**
     * Uninstall a plugin from the kernel.
     */
    async uninstallPlugin(name: string): Promise<void> {
      const plugin = plugins.get(name);
      if (!plugin) return;

      // Remove rules from this plugin
      const prefix = name + '/';
      for (const [ruleName] of rules) {
        if (ruleName.startsWith(prefix)) {
          rules.delete(ruleName);
        }
      }

      if (plugin.onDestroy) {
        await plugin.onDestroy();
      }

      plugins.delete(name);
    },

    /**
     * Initialize all plugins with the built graph.
     */
    async initPlugins(graph: CodebaseGraph): Promise<void> {
      for (const plugin of plugins.values()) {
        if (plugin.onInit) {
          try {
            await plugin.onInit(graph);
          } catch (err) {
            if (plugin.onError && err instanceof Error) {
              plugin.onError(err);
            }
          }
        }
      }
    },

    /**
     * Get all registered rules.
     */
    getRules(): Rule[] {
      return Array.from(rules.values());
    },

    /**
     * Get all installed plugin names.
     */
    getPluginNames(): string[] {
      return Array.from(plugins.keys());
    },

    /**
     * Check if a plugin is installed.
     */
    hasPlugin(name: string): boolean {
      return plugins.has(name);
    },

    /**
     * Get the number of registered rules.
     */
    getRuleCount(): number {
      return rules.size;
    },
  };
}

export type Kernel = ReturnType<typeof createKernel>;
