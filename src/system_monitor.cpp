#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/float64.hpp>
#include <fstream>
#include <sstream>
#include <vector>

class SystemMonitor : public rclcpp::Node
{
public:
  SystemMonitor()
  : Node("system_monitor")
  {
    this->declare_parameter("publish_rate", 1.0);
    double publish_rate = this->get_parameter("publish_rate").as_double();

    cpu_pub_ = this->create_publisher<std_msgs::msg::Float64>("system/cpu_usage", 10);
    mem_pub_ = this->create_publisher<std_msgs::msg::Float64>("system/memory_available_gb", 10);
    mem_total_pub_ = this->create_publisher<std_msgs::msg::Float64>("system/memory_total_gb", 10);
    mem_percent_pub_ = this->create_publisher<std_msgs::msg::Float64>("system/memory_usage_percent", 10);

    // Save previous CPU stats for calculating usage
    prev_cpu_stats_ = getCpuStats();

    timer_ = this->create_wall_timer(
      std::chrono::duration<double>(1.0 / publish_rate),
      std::bind(&SystemMonitor::publishStats, this));

    RCLCPP_INFO(this->get_logger(), "System Monitor started");
  }

private:
  std::vector<long long> getCpuStats()
  {
    std::vector<long long> stats;
    std::ifstream file("/proc/stat");
    std::string line;

    if (std::getline(file, line)) {
      std::istringstream iss(line);
      std::string cpu;
      iss >> cpu;
      long long value;
      while (iss >> value) {
        stats.push_back(value);
      }
    }
    return stats;
  }

  double getCpuUsage()
  {
    auto current_stats = getCpuStats();

    if (current_stats.size() < 4 || prev_cpu_stats_.size() < 4) {
      return 0.0;
    }

    // Calculate differences
    long long prev_idle = prev_cpu_stats_[3];
    long long curr_idle = current_stats[3];

    long long prev_total = 0;
    long long curr_total = 0;

    for (size_t i = 0; i < std::min(prev_cpu_stats_.size(), current_stats.size()); i++) {
      prev_total += prev_cpu_stats_[i];
      curr_total += current_stats[i];
    }

    long long total_diff = curr_total - prev_total;
    long long idle_diff = curr_idle - prev_idle;

    prev_cpu_stats_ = current_stats;

    if (total_diff == 0) {
      return 0.0;
    }

    return 100.0 * (1.0 - static_cast<double>(idle_diff) / static_cast<double>(total_diff));
  }

  void publishStats()
  {
    // CPU Usage
    auto cpu_msg = std_msgs::msg::Float64();
    cpu_msg.data = getCpuUsage();
    cpu_pub_->publish(cpu_msg);

    // Memory Info
    std::ifstream mem_file("/proc/meminfo");
    std::string line;
    long long mem_total = 0, mem_available = 0;

    while (std::getline(mem_file, line)) {
      if (line.find("MemTotal:") == 0) {
        std::istringstream iss(line);
        std::string key;
        iss >> key >> mem_total;
      } else if (line.find("MemAvailable:") == 0) {
        std::istringstream iss(line);
        std::string key;
        iss >> key >> mem_available;
      }
    }

    double mem_total_gb = mem_total / (1024.0 * 1024.0);
    double mem_available_gb = mem_available / (1024.0 * 1024.0);
    double mem_usage_percent = 100.0 * (1.0 - static_cast<double>(mem_available) / static_cast<double>(mem_total));

    auto mem_msg = std_msgs::msg::Float64();
    mem_msg.data = mem_available_gb;
    mem_pub_->publish(mem_msg);

    auto mem_total_msg = std_msgs::msg::Float64();
    mem_total_msg.data = mem_total_gb;
    mem_total_pub_->publish(mem_total_msg);

    auto mem_percent_msg = std_msgs::msg::Float64();
    mem_percent_msg.data = mem_usage_percent;
    mem_percent_pub_->publish(mem_percent_msg);
  }

  rclcpp::Publisher<std_msgs::msg::Float64>::SharedPtr cpu_pub_;
  rclcpp::Publisher<std_msgs::msg::Float64>::SharedPtr mem_pub_;
  rclcpp::Publisher<std_msgs::msg::Float64>::SharedPtr mem_total_pub_;
  rclcpp::Publisher<std_msgs::msg::Float64>::SharedPtr mem_percent_pub_;
  rclcpp::TimerBase::SharedPtr timer_;

  std::vector<long long> prev_cpu_stats_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SystemMonitor>());
  rclcpp::shutdown();
  return 0;
}
